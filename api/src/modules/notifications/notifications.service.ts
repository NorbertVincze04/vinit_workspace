import type { Knex } from 'knex';
import { addDays, bucharestTime, monthOf, today } from '../../lib/dates.js';
import { TARGETS } from '../../lib/targets.js';
import { billingWarnings } from '../billing/billing.service.js';

type Db = Knex | Knex.Transaction;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Candidate {
  /** Same key = same event: never notified twice to the same person. */
  key: string;
  kind: string;
  severity: 'info' | 'warn' | 'bad';
  title: string;
  body?: string;
  link: string;
  salonId?: string | null;
  dueOn?: string | null;
  /** Only these people (e.g. the lead's owner); everyone when empty. */
  userIds?: (string | null)[];
}

const ISO_WEEK = (d: Date): string => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
};

/** "Due today at 14:30", "Due tomorrow", "Due in 3 days (2026-11-12)". */
export function dueText(daysLeft: number, time: string | null, dueOn: string): string {
  const at = time ? ` at ${time}` : '';
  if (daysLeft === 0) return `Due today${at}`;
  if (daysLeft === 1) return `Due tomorrow${at}`;
  return `Due in ${daysLeft} days (${dueOn}${at})`;
}

/** Everything worth a notification right now. */
export async function candidates(k: Db): Promise<Candidate[]> {
  const now = today();
  const out: Candidate[] = [];

  // Money: overdue payments, trials ending or over, past due, salons without a subscription, Early Bird.
  for (const w of await billingWarnings(k)) {
    if (w.kind === 'min_term_ending') continue;
    out.push({
      key: `${w.kind}:${w.paymentId ?? w.subscriptionId ?? w.salonId ?? ''}:${w.dueOn ?? ''}`,
      kind: w.kind,
      severity: w.severity,
      title: w.salonName ? `${w.salonName}: ${w.message}` : w.message,
      link: w.salonId ? `/tools/salons/${w.salonId}?tab=billing` : '/tools/subscriptions',
      salonId: w.salonId ?? null,
      dueOn: w.dueOn ?? null,
    });
  }

  // Onboardings over 48h, or blocked.
  const obs = await k('onboardings as o')
    .join('salons as s', 's.id', 'o.salonId')
    .whereNot('o.status', 'done')
    .select(
      'o.id',
      'o.salonId',
      'o.status',
      'o.blockedReason',
      's.name as salonName',
      k.raw(`(o.materials_received_at IS NOT NULL AND now() > o.materials_received_at + interval '${TARGETS.onboardingHours} hours') as late`),
    );
  for (const o of obs) {
    const link = `/tools/salons/${o.salonId}?tab=onboarding`;
    if (o.late) out.push({ key: `onboarding-late:${o.id}`, kind: 'onboarding_late', severity: 'bad', title: `${o.salonName}: onboarding is over ${TARGETS.onboardingHours}h`, link, salonId: o.salonId });
    if (o.status === 'blocked') {
      out.push({ key: `onboarding-blocked:${o.id}:${String(o.blockedReason).slice(0, 60)}`, kind: 'onboarding_blocked', severity: 'warn', title: `${o.salonName}: onboarding blocked`, body: o.blockedReason, link, salonId: o.salonId });
    }
  }

  // Lead follow-ups due: to the lead's owner.
  const leads = await k('leads').whereIn('stage', ['contacted', 'replied', 'demo_booked']).whereNotNull('nextFollowUpOn').where('nextFollowUpOn', '<=', now).select('id', 'businessName', 'nextFollowUpOn', 'ownerUserId');
  for (const l of leads) {
    out.push({
      key: `lead-followup:${l.id}:${l.nextFollowUpOn}`,
      kind: 'lead_followup',
      severity: l.nextFollowUpOn < now ? 'warn' : 'info',
      title: `Follow up ${l.businessName}`,
      body: l.nextFollowUpOn < now ? `Was due ${l.nextFollowUpOn}` : 'Due today',
      link: '/tools/leads',
      dueOn: l.nextFollowUpOn,
      userIds: l.ownerUserId ? [l.ownerUserId] : [],
    });
  }

  // Urgent and high tickets: to the assignee.
  const tickets = await k('tickets as t').join('salons as s', 's.id', 't.salonId').whereIn('t.status', ['open', 'in_progress', 'waiting_client']).whereIn('t.priority', ['urgent', 'high']).select('t.id', 't.number', 't.title', 't.priority', 't.salonId', 't.assigneeId', 's.name as salonName');
  for (const t of tickets) {
    out.push({
      key: `ticket:${t.id}:${t.priority}`,
      kind: 'ticket',
      severity: t.priority === 'urgent' ? 'bad' : 'warn',
      title: `${t.salonName}: T-${String(t.number).padStart(4, '0')} ${t.title}`,
      body: t.priority === 'urgent' ? 'Urgent ticket' : 'High-priority ticket',
      link: `/tools/salons/${t.salonId}?tab=support`,
      salonId: t.salonId,
      userIds: t.assigneeId ? [t.assigneeId] : [],
    });
  }

  // Deadlines: the latest reminder that has passed (a new notification for each one), and once when
  // late (the day after). All-day reminders go off at 09:00 Bucharest time. Trials are covered above.
  const deadlines = await k('deadlines as d')
    .where('d.status', 'open')
    .where('d.dueOn', '<=', addDays(now, 366))
    .whereRaw(`coalesce(d.source_type, '') <> 'trial'`)
    .select('d.*', k.raw('(d.due_on - ?::date) as days_left', [now]));
  const nowMs = Date.now();
  for (const d of deadlines as Row[]) {
    const left = Number(d.daysLeft);
    const at = d.allDay ? '' : ` ${d.dueTime}`;
    const base = { kind: 'deadline', title: d.title, link: '/tools/calendar', salonId: d.salonId, dueOn: d.dueOn };
    if (left < 0) {
      out.push({ ...base, key: `deadline:${d.id}:late:${d.dueOn}${at}`, severity: 'bad', body: `Was due ${d.dueOn}${at}` });
      continue;
    }
    const event = bucharestTime(d.dueOn, d.allDay ? '09:00' : d.dueTime).getTime();
    const passed = (d.reminders as number[]).filter((m) => event - m * 60_000 <= nowMs);
    if (!passed.length) continue;
    // Several passed (e.g. the PC was off): only the latest one.
    const minutes = Math.min(...passed);
    out.push({
      ...base,
      key: `deadline:${d.id}:${minutes}:${d.dueOn}${at}`,
      severity: left === 0 ? 'warn' : 'info',
      body: dueText(left, d.allDay ? null : d.dueTime, d.dueOn),
    });
  }

  // SMS budget: once at 80% and once at 100% each month.
  const month = monthOf(now);
  const [{ sent }] = await k('smsUsage').where({ month }).select(k.raw('coalesce(sum(sent), 0)::int as sent'));
  const pct = Math.round((Number(sent) / TARGETS.smsMonthlyBudget) * 100);
  for (const level of [100, 80]) {
    if (pct >= level) {
      out.push({ key: `sms:${month}:${level}`, kind: 'sms_budget', severity: level === 100 ? 'bad' : 'warn', title: `SMS: ${pct}% of the monthly budget used`, body: `${sent} of ${TARGETS.smsMonthlyBudget} SMS`, link: '/tools/infra' });
      break;
    }
  }

  // Backups: a nudge each week without one.
  const lastBackup = await k('backupChecks').where({ kind: 'backup' }).max({ at: 'checkedAt' }).first();
  const age = lastBackup?.at ? (Date.now() - new Date(lastBackup.at).getTime()) / 86_400_000 : null;
  if (age === null || age > 7) {
    out.push({
      key: `backup:${ISO_WEEK(new Date())}`,
      kind: 'backup',
      severity: age === null || age > 30 ? 'bad' : 'warn',
      title: age === null ? 'No database backup recorded yet' : `Last backup ${Math.floor(age)} days ago`,
      body: 'Run npm run db:backup and copy the file off this PC.',
      link: '/tools/infra',
    });
  }

  return out;
}

/**
 * Creates the notifications that don't exist yet, per active user (idempotent), and forgets read
 * ones older than 60 days. Returns how many were created.
 */
export async function generateNotifications(k: Db): Promise<number> {
  const users = (await k('users').where({ isActive: true }).select('id')).map((u: Row) => u.id as string);
  if (!users.length) return 0;
  const rows: Row[] = [];
  for (const c of await candidates(k)) {
    const targets = c.userIds?.filter(Boolean).length ? (c.userIds!.filter((id) => id && users.includes(id)) as string[]) : users;
    for (const userId of targets) {
      rows.push({ userId, kind: c.kind, severity: c.severity, title: c.title.slice(0, 300), body: (c.body ?? '').slice(0, 1000), link: c.link, salonId: c.salonId ?? null, dueOn: c.dueOn ?? null, dedupeKey: c.key.slice(0, 300) });
    }
  }
  let created = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const inserted = await k('notifications').insert(rows.slice(i, i + 200)).onConflict(['user_id', 'dedupe_key']).ignore().returning('id');
    created += inserted.length;
  }
  await k('notifications').whereNotNull('readAt').where('createdAt', '<', k.raw(`now() - interval '60 days'`)).delete();
  return created;
}
