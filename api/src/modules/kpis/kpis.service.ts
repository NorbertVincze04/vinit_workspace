import type { Knex } from 'knex';
import { addDays, monthEnd, monthOf, monthRange, monthStart, today } from '../../lib/dates.js';
import { targetsLookup } from '../../lib/targets.js';
import { BillingCycle, LIVE_STATUSES, PAYING_STATUSES } from '../billing/billing.schemas.js';
import { monthlyBani } from '../billing/billing.service.js';

type Db = Knex | Knex.Transaction;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface MonthKpis {
  month: string;
  /** Subscriptions active or past due at the end of the month. */
  paying: number;
  mrrBani: number;
  /** Salons by status at the end of the month. */
  salons: { active: number; trial: number; paused: number; churned: number; lead: number };
  /** Became paying this month (new, or trial converted). */
  newPaying: number;
  /** Salons that left (status → churned) this month. */
  churned: number;
  /** Paying at the start of the month (base for retention). */
  payingAtStart: number;
  /** Decision E: share of the salons paying at the start that are still with us at the end. */
  retentionPct: number | null;
  /** Same, from the start of the year to the end of this month. */
  retentionYtdPct: number | null;
  trialsEnded: number;
  trialsConverted: number;
  trialToPaidPct: number | null;
  onboardingsLive: number;
  onboardingsWithin48h: number;
  avgOnboardingHours: number | null;
  leadsNew: number;
  leadsConverted: number;
  leadsLost: number;
  /** Leads per stage now (only meaningful for the current month). */
  pipeline: Record<string, number>;
  /** True when read from a frozen snapshot. */
  snapshot?: boolean;
}

const LIVE = LIVE_STATUSES as readonly string[];
const PAYING = PAYING_STATUSES as readonly string[];
const pct = (part: number, whole: number): number | null => (whole ? Math.round((part / whole) * 1000) / 10 : null);

/** Last state of each record on or before `date`, from a history sorted by date. */
function stateAt<T extends Row>(history: Map<string, T[]>, date: string, dateKey: string): Map<string, T> {
  const out = new Map<string, T>();
  for (const [id, list] of history) {
    let last: T | undefined;
    for (const entry of list) if (entry[dateKey] <= date) last = entry;
    if (last) out.set(id, last);
  }
  return out;
}

function group<T extends Row>(rows: T[], key: string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(r[key], [...(map.get(r[key]) ?? []), r]);
  return map;
}

/** Everything the computations need, read once (a few hundred rows at most). */
async function loadHistory(k: Db) {
  const [targets, changes, statusHistory, subs, onboardings, leads, lostChanges] = await Promise.all([
    targetsLookup(k),
    k('subscriptionChanges')
      .orderBy([{ column: 'changedOn' }, { column: 'createdAt' }])
      .select('subscriptionId', 'changedOn', 'kind', 'fromStatus', 'toStatus', 'toPriceBani', 'billingCycle'),
    k('salonStatusHistory').orderBy([{ column: 'changedOn' }, { column: 'createdAt' }]).select('salonId', 'changedOn', 'toStatus'),
    k('subscriptions').select('id', 'trialEndsOn'),
    k('onboardings')
      .whereNotNull('wentLiveAt')
      .whereNotNull('materialsReceivedAt')
      .select(
        k.raw(`to_char(went_live_at AT TIME ZONE 'Europe/Bucharest', 'YYYY-MM') as month`),
        k.raw(`extract(epoch FROM (went_live_at - materials_received_at)) / 3600.0 as hours`),
      ),
    k('leads').select(
      'stage',
      k.raw(`to_char(created_at AT TIME ZONE 'Europe/Bucharest', 'YYYY-MM') as created_month`),
      k.raw(`to_char(converted_at AT TIME ZONE 'Europe/Bucharest', 'YYYY-MM') as converted_month`),
    ),
    k('leadActivities')
      .where({ kind: 'stage_change', toStage: 'lost' })
      .select(k.raw(`to_char(occurred_at AT TIME ZONE 'Europe/Bucharest', 'YYYY-MM') as month`)),
  ]);
  return {
    targets,
    changes: changes as Row[],
    bySub: group(changes as Row[], 'subscriptionId'),
    bySalon: group(statusHistory as Row[], 'salonId'),
    statusHistory: statusHistory as Row[],
    subs: subs as Row[],
    onboardings: onboardings as Row[],
    leads: leads as Row[],
    lostChanges: lostChanges as Row[],
  };
}

type History = Awaited<ReturnType<typeof loadHistory>>;

function compute(h: History, month: string): MonthKpis {
  const start = monthStart(month);
  const end = monthEnd(month);
  const inMonth = (d: string | null | undefined) => !!d && d >= start && d <= end;

  const subsAtEnd = stateAt(h.bySub, end, 'changedOn');
  const subsAtStart = stateAt(h.bySub, addDays(start, -1), 'changedOn');
  const payingIds = (m: Map<string, Row>) => new Set([...m].filter(([, s]) => PAYING.includes(s.toStatus)).map(([id]) => id));
  const payingEnd = payingIds(subsAtEnd);
  const payingStart = payingIds(subsAtStart);
  const stillLive = (ids: Set<string>) => [...ids].filter((id) => LIVE.includes(subsAtEnd.get(id)?.toStatus)).length;

  const yearStartIds = payingIds(stateAt(h.bySub, `${Number(month.slice(0, 4)) - 1}-12-31`, 'changedOn'));

  let mrrBani = 0;
  for (const id of payingEnd) {
    const s = subsAtEnd.get(id)!;
    mrrBani += monthlyBani(Number(s.toPriceBani), s.billingCycle as BillingCycle);
  }

  const salonStates = stateAt(h.bySalon, end, 'changedOn');
  const salons = { active: 0, trial: 0, paused: 0, churned: 0, lead: 0 };
  for (const s of salonStates.values()) salons[s.toStatus as keyof typeof salons]++;

  const newPaying = h.changes.filter(
    (c) => inMonth(c.changedOn) && PAYING.includes(c.toStatus) && (c.fromStatus === null || c.fromStatus === 'trialing'),
  ).length;
  const churned = h.statusHistory.filter((s) => inMonth(s.changedOn) && s.toStatus === 'churned').length;

  const converted = new Set(h.changes.filter((c) => c.kind === 'trial_converted').map((c) => c.subscriptionId));
  const trials = h.subs.filter((s) => inMonth(s.trialEndsOn));
  const trialsConverted = trials.filter((s) => converted.has(s.id)).length;

  const live = h.onboardings.filter((o) => o.month === month);
  const within = live.filter((o) => Number(o.hours) <= h.targets(month).onboardingHours).length;
  const avg = live.length ? Math.round((live.reduce((sum, o) => sum + Number(o.hours), 0) / live.length) * 10) / 10 : null;

  const pipeline: Record<string, number> = {};
  for (const l of h.leads) pipeline[l.stage] = (pipeline[l.stage] ?? 0) + 1;

  return {
    month,
    paying: payingEnd.size,
    mrrBani,
    salons,
    newPaying,
    churned,
    payingAtStart: payingStart.size,
    retentionPct: pct(stillLive(payingStart), payingStart.size),
    retentionYtdPct: pct(stillLive(yearStartIds), yearStartIds.size),
    trialsEnded: trials.length,
    trialsConverted,
    trialToPaidPct: pct(trialsConverted, trials.length),
    onboardingsLive: live.length,
    onboardingsWithin48h: within,
    avgOnboardingHours: avg,
    leadsNew: h.leads.filter((l) => l.createdMonth === month).length,
    leadsConverted: h.leads.filter((l) => l.convertedMonth === month).length,
    leadsLost: h.lostChanges.filter((l) => l.month === month).length,
    pipeline,
  };
}

/** KPIs for one month: live for the current month, the snapshot for a closed one when there is one. */
export async function monthKpis(k: Db, month: string): Promise<MonthKpis> {
  const snap = month < monthOf(today()) ? await k('kpiSnapshots').where({ month }).first('data') : null;
  if (snap) return { ...(snap.data as MonthKpis), snapshot: true };
  return compute(await loadHistory(k), month);
}

/** One entry per month; closed months come from their snapshot when it exists. */
export async function kpiHistory(k: Db, from: string, to: string): Promise<MonthKpis[]> {
  const [history, snaps] = await Promise.all([loadHistory(k), k('kpiSnapshots').whereBetween('month', [from, to]).select('month', 'data')]);
  const frozen = new Map(snaps.map((s: Row) => [s.month, s.data as MonthKpis]));
  return monthRange(from, to).map((m) => (frozen.has(m) ? { ...frozen.get(m)!, snapshot: true } : compute(history, m)));
}

/** First month with any data (status history or subscription changes). */
async function firstMonth(k: Db): Promise<string | null> {
  const [row] = await k.raw(`SELECT least(
      (SELECT min(changed_on) FROM salon_status_history),
      (SELECT min(changed_on) FROM subscription_changes)) as first`).then((r: { rows: Row[] }) => r.rows);
  return row?.first ? monthOf(String(row.first)) : null;
}

/**
 * Freezes every finished month that has no snapshot yet. Idempotent; run on start-up and every few
 * hours (the PC isn't always on, so it catches up whenever the API runs). Returns months written.
 */
export async function ensureSnapshots(k: Db): Promise<string[]> {
  const first = await firstMonth(k);
  const last = monthOf(addDays(monthStart(monthOf(today())), -1));
  if (!first || first > last) return [];
  const existing = new Set((await k('kpiSnapshots').select('month')).map((r: Row) => r.month as string));
  const missing = monthRange(first, last).filter((m) => !existing.has(m));
  if (!missing.length) return [];
  const history = await loadHistory(k);
  for (const m of missing) {
    await k('kpiSnapshots').insert({ month: m, data: JSON.stringify(compute(history, m)) }).onConflict('month').ignore();
  }
  return missing;
}

/** Recomputes a closed month's snapshot (after fixing old data on purpose). */
export async function rebuildSnapshot(k: Db, month: string): Promise<MonthKpis> {
  const data = compute(await loadHistory(k), month);
  await k('kpiSnapshots').insert({ month, data: JSON.stringify(data) }).onConflict('month').merge();
  return { ...data, snapshot: true };
}

export interface PeriodSummary {
  /** Paying salons and MRR at the end of the period (or now, when it hasn't ended). */
  payingEnd: number;
  mrrEndBani: number;
  /** Paying at the start of the period that are still live at its end. */
  payingAtStart: number;
  retentionPct: number | null;
  newPaying: number;
  churned: number;
  onboardingsLive: number;
  avgOnboardingHours: number | null;
}

/** One figure per KPI for a range of months (a plan year): end-of-period state and period totals. */
export async function periodSummary(k: Db, from: string, to: string): Promise<PeriodSummary> {
  const h = await loadHistory(k);
  const last = to < monthOf(today()) ? to : monthOf(today());
  const end = monthEnd(last);
  const subsAtEnd = stateAt(h.bySub, end, 'changedOn');
  const subsAtStart = stateAt(h.bySub, addDays(monthStart(from), -1), 'changedOn');
  const payingIds = (m: Map<string, Row>) => new Set([...m].filter(([, s]) => PAYING.includes(s.toStatus)).map(([id]) => id));
  const payingStart = payingIds(subsAtStart);
  const months = monthRange(from, last);
  const perMonth = months.map((m) => compute(h, m));
  const live = h.onboardings.filter((o) => o.month >= from && o.month <= last);
  const end_ = perMonth.at(-1);
  return {
    payingEnd: end_?.paying ?? 0,
    mrrEndBani: end_?.mrrBani ?? 0,
    payingAtStart: payingStart.size,
    retentionPct: pct([...payingStart].filter((id) => LIVE.includes(subsAtEnd.get(id)?.toStatus)).length, payingStart.size),
    newPaying: perMonth.reduce((s, m) => s + m.newPaying, 0),
    churned: perMonth.reduce((s, m) => s + m.churned, 0),
    onboardingsLive: live.length,
    avgOnboardingHours: live.length ? Math.round((live.reduce((s, o) => s + Number(o.hours), 0) / live.length) * 10) / 10 : null,
  };
}
