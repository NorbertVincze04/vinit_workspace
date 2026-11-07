import type { Knex } from 'knex';
import { monthEnd, monthOf, monthRange, today } from '../../lib/dates.js';
import { GOAL_KEYS, Goals, planStart, resolveGoals, yearOfMonth, yearRange } from '../../lib/targets.js';
import { periodSummary } from '../kpis/kpis.service.js';

type Db = Knex | Knex.Transaction;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface PlanStep {
  id: string;
  text: string;
  position: number;
  done: boolean;
}

export interface PlanPhase {
  id: string;
  key: string | null;
  name: string;
  monthFrom: number;
  monthTo: number;
  goal: string;
  milestone: string;
  position: number;
  steps: PlanStep[];
}

export interface PlanYear {
  year: number;
  /** "YYYY-MM" of its first and last month. */
  from: string;
  to: string;
  status: 'past' | 'current' | 'future';
  /** What you set (null = not set). */
  goals: Goals;
  /** In force (with fallbacks from earlier years / the built-in plan). */
  effective: Record<string, number | null>;
  notes: string;
  phases: PlanPhase[];
}

const goalsOf = (row: Row): Goals => Object.fromEntries(GOAL_KEYS.map((k) => [k, row[k] === null || row[k] === undefined ? null : Number(row[k])])) as Goals;

/** Every plan year with its goals and roadmap (phases → steps, ticks). */
export async function planYears(k: Db): Promise<{ start: string; currentYear: number; items: PlanYear[] }> {
  const [start, years, phases, steps, progress] = await Promise.all([
    planStart(k),
    k('planYears').orderBy('year'),
    k('roadmapPhases').orderBy([{ column: 'year' }, { column: 'position' }, { column: 'monthFrom' }]),
    k('roadmapSteps').orderBy([{ column: 'position' }, { column: 'id' }]).select('id', 'text', 'position', 'phaseId'),
    k('roadmapProgress').select('stepId'),
  ]);
  const done = new Set((progress as Row[]).map((p) => p.stepId));
  const effective = resolveGoals(years);
  const currentYear = yearOfMonth(start, monthOf(today()));
  const now = monthOf(today());
  return {
    start,
    currentYear,
    items: (years as Row[]).map((y) => {
      const range = yearRange(start, y.year);
      return {
        year: y.year,
        ...range,
        // Before the plan starts, Year 1 is the current one.
        status: range.to < now ? 'past' : y.year === currentYear ? 'current' : 'future',
        goals: goalsOf(y),
        effective: { ...effective.get(y.year)! },
        notes: y.notes,
        phases: (phases as Row[])
          .filter((p) => p.year === y.year)
          .map((p) => ({
            id: p.id,
            key: p.key,
            name: p.name,
            monthFrom: p.monthFrom,
            monthTo: p.monthTo,
            goal: p.goal,
            milestone: p.milestone,
            position: p.position,
            steps: (steps as Row[]).filter((s) => s.phaseId === p.id).map((s) => ({ id: s.id, text: s.text, position: s.position, done: done.has(s.id) })),
          })),
      };
    }),
  };
}

export interface YearResults {
  year: number;
  from: string;
  to: string;
  /** Months counted so far (12 for a past year). */
  months: number;
  actual: {
    payingSalons: number;
    mrrBani: number;
    /** Business income booked in Finances in the year (EUR/USD converted). */
    incomeBani: number;
    /** Average monthly business expenses in Finances. */
    monthlyCostsBani: number | null;
    retentionPct: number | null;
    onboardingHours: number | null;
    /** The busiest SMS month. */
    smsMonthlyMax: number;
  };
  steps: { done: number; total: number };
  newPaying: number;
  churned: number;
}

async function rates(k: Db): Promise<Record<string, number>> {
  const row = await k('appSettings').where({ key: 'finances.rates' }).first('value');
  const v = (row?.value ?? {}) as { eur?: number; usd?: number };
  return { RON: 1, EUR: Number(v.eur) || 5, USD: Number(v.usd) || 4.6 };
}

/** What actually happened in a plan year (so far, for the current one). */
export async function yearResults(k: Db, year: number): Promise<YearResults> {
  const start = await planStart(k);
  const { from, to } = yearRange(start, year);
  const now = monthOf(today());
  const last = to < now ? to : now;
  const months = from > now ? 0 : monthRange(from, last).length;
  const fromDate = `${from}-01`;
  const toDate = monthEnd(last);

  const [summary, r, money, sms, steps] = await Promise.all([
    periodSummary(k, from, to),
    rates(k),
    k('finTransactions')
      .where({ scope: 'business' })
      .whereIn('type', ['income', 'expense'])
      .where('date', '>=', fromDate)
      .where('date', '<=', toDate)
      .groupBy('type', 'currency')
      .select('type', 'currency', k.raw('sum(amount_bani)::bigint as total')),
    k('smsUsage').whereBetween('month', [from, last]).groupBy('month').select('month', k.raw('sum(sent)::int as sent')),
    k('roadmapSteps as s')
      .join('roadmapPhases as p', 'p.id', 's.phaseId')
      .leftJoin('roadmapProgress as g', 'g.stepId', 's.id')
      .where('p.year', year)
      .select(k.raw('count(*)::int as total'), k.raw('count(g.step_id)::int as done'))
      .first(),
  ]);
  const sum = (type: string) => (money as Row[]).filter((m) => m.type === type).reduce((s, m) => s + Math.round(Number(m.total) * (r[m.currency] ?? 1)), 0);
  return {
    year,
    from,
    to,
    months,
    actual: {
      payingSalons: summary.payingEnd,
      mrrBani: summary.mrrEndBani,
      incomeBani: sum('income'),
      monthlyCostsBani: months ? Math.round(sum('expense') / months) : null,
      retentionPct: summary.retentionPct,
      onboardingHours: summary.avgOnboardingHours,
      smsMonthlyMax: Math.max(0, ...(sms as Row[]).map((s) => Number(s.sent))),
    },
    steps: { done: steps?.done ?? 0, total: steps?.total ?? 0 },
    newPaying: summary.newPaying,
    churned: summary.churned,
  };
}
