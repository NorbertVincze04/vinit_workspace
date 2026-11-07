import type { Knex } from 'knex';
import type { z } from 'zod';
import { HttpError, notFound } from '../../http/errors.js';
import { logActivity } from '../../lib/activity.js';
import { addDays, addMonths, monthEnd, monthOf, monthRange, monthsBetween, today } from '../../lib/dates.js';
import { setSalonStatus } from '../salons/salons.service.js';
import {
  BillingCycle,
  ChangeKind,
  LIVE_STATUSES,
  PAYING_STATUSES,
  SubStatus,
  markPaid as markPaidSchema,
  subscriptionChange,
  subscriptionCreate,
} from './billing.schemas.js';

type Db = Knex | Knex.Transaction;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const CYCLE_MONTHS: Record<BillingCycle, number> = { monthly: 1, quarterly: 3, yearly: 12, one_off: 0 };

/** Price per billing period → per month (one-off projects are not recurring revenue). */
export function monthlyBani(priceBani: number, cycle: BillingCycle): number {
  const months = CYCLE_MONTHS[cycle];
  return months ? Math.round(priceBani / months) : 0;
}

/** The subscription's contribution to MRR, in SQL (active and past_due only). */
export const MRR_SQL = `(CASE WHEN x.status IN ('active', 'past_due') THEN CASE x.billing_cycle
  WHEN 'monthly' THEN x.price_bani WHEN 'quarterly' THEN round(x.price_bani / 3.0)
  WHEN 'yearly' THEN round(x.price_bani / 12.0) ELSE 0 END ELSE 0 END)::int`;

export function subscriptionRows(k: Db): Knex.QueryBuilder {
  return k('subscriptions as x')
    .join('salons as s', 's.id', 'x.salonId')
    .join('plans as p', 'p.id', 'x.planId')
    .leftJoin('promotions as pr', 'pr.id', 'x.promotionId')
    .select(
      'x.*',
      's.name as salonName',
      's.status as salonStatus',
      'p.code as planCode',
      'p.name as planName',
      'pr.code as promotionCode',
      'pr.name as promotionName',
      k.raw(`${MRR_SQL} as mrr_bani`),
    );
}

export async function getSubscriptionRow(k: Db, id: string): Promise<Row> {
  const row = await subscriptionRows(k).where('x.id', id).first();
  if (!row) throw notFound('Subscription');
  return row;
}

const SALON_STATUS_FOR: Partial<Record<SubStatus, 'trial' | 'active' | 'paused'>> = {
  trialing: 'trial',
  active: 'active',
  paused: 'paused',
};

async function syncSalon(
  trx: Knex.Transaction,
  salonId: string,
  status: SubStatus,
  input: { userId?: string | null; on: string; reason?: string },
): Promise<void> {
  if (status === 'canceled') {
    await setSalonStatus(trx, salonId, 'churned', { userId: input.userId, on: input.on, reason: input.reason || 'Subscription canceled' });
    return;
  }
  const target = SALON_STATUS_FOR[status];
  if (target) await setSalonStatus(trx, salonId, target, { userId: input.userId, on: input.on, reason: input.reason });
}

async function recordChange(
  trx: Knex.Transaction,
  before: Row | null,
  after: Row,
  kind: ChangeKind,
  on: string,
  note: string,
  userId?: string | null,
): Promise<void> {
  await trx('subscriptionChanges').insert({
    subscriptionId: after.id,
    changedOn: on,
    kind,
    fromPlanId: before?.planId ?? null,
    toPlanId: after.planId,
    fromPriceBani: before?.priceBani ?? null,
    toPriceBani: after.priceBani,
    fromStatus: before?.status ?? null,
    toStatus: after.status,
    billingCycle: after.billingCycle,
    note,
    changedBy: userId ?? null,
  });
}

/** Default price for a plan and billing cycle (per period). */
function planPrice(plan: Row, cycle: BillingCycle): number {
  if (cycle === 'one_off') return Number(plan.oneOffFromBani ?? plan.monthlyPriceBani);
  return Number(plan.monthlyPriceBani) * CYCLE_MONTHS[cycle];
}

/**
 * Starts a salon's subscription. A promotion with free months (Early Bird: 3) starts a trial that
 * ends the day before the first paid day; a promotion with a place limit (Early Bird: 50) refuses
 * once it is full. The salon's plan and status follow the subscription.
 */
export async function createSubscription(
  trx: Knex.Transaction,
  salonId: string,
  input: z.infer<typeof subscriptionCreate>,
  userId?: string | null,
): Promise<string> {
  const salon = await trx('salons').where({ id: salonId }).forUpdate().first();
  if (!salon) throw notFound('Salon');
  const live = await trx('subscriptions').where({ salonId }).whereIn('status', LIVE_STATUSES).first('id');
  if (live) throw new HttpError(409, 'has_subscription', 'This salon already has a running subscription. Change or cancel it instead.');

  const plan = await trx('plans').where({ id: input.planId }).first();
  if (!plan) throw new HttpError(400, 'validation', 'This plan does not exist.', { planId: 'Pick a plan.' });

  let promo: Row | null = null;
  if (input.promotionId) {
    promo = await trx('promotions').where({ id: input.promotionId }).forUpdate().first();
    if (!promo) throw new HttpError(400, 'validation', 'This promotion does not exist.', { promotionId: 'Pick a promotion.' });
    if (!promo.isActive) throw new HttpError(409, 'promotion_closed', `${promo.name} is no longer offered.`);
    if (promo.maxSalons) {
      const [{ used }] = await trx('subscriptions').where({ promotionId: promo.id }).count({ used: '*' });
      if (Number(used) >= promo.maxSalons) {
        throw new HttpError(409, 'promotion_full', `All ${promo.maxSalons} ${promo.name} places are taken.`);
      }
    }
  }

  const startedOn = input.startedOn ?? today();
  const cycle = input.billingCycle ?? 'monthly';
  const base = planPrice(plan, cycle);
  const priceBani = input.priceBani ?? (promo?.discountPct ? Math.round((base * (100 - promo.discountPct)) / 100) : base);
  const trialEndsOn =
    input.trialEndsOn !== undefined ? input.trialEndsOn : promo?.freeMonths ? addDays(addMonths(startedOn, promo.freeMonths), -1) : null;
  // Free (trial end, or a 100% discount such as Beta) → trialing; otherwise paying from day one.
  const status: SubStatus = input.status ?? (trialEndsOn || promo?.discountPct === 100 ? 'trialing' : 'active');
  const firstPaidDay = trialEndsOn ? addDays(trialEndsOn, 1) : startedOn;
  const minTermEndsOn = plan.minTermMonths && cycle !== 'one_off' ? addDays(addMonths(firstPaidDay, plan.minTermMonths), -1) : null;

  const [sub] = await trx('subscriptions')
    .insert({
      salonId,
      planId: plan.id,
      priceBani,
      billingCycle: cycle,
      status,
      startedOn,
      trialEndsOn,
      minTermEndsOn,
      promotionId: promo?.id ?? null,
      notes: input.notes ?? '',
    })
    .returning('*');
  await recordChange(trx, null, sub, 'start', startedOn, promo ? promo.name : '', userId);

  // A one-off project is billed once, when it starts.
  if (cycle === 'one_off' && status === 'active') {
    await trx('payments').insert({ subscriptionId: sub.id, salonId, kind: 'one_off', amountBani: priceBani, dueOn: startedOn });
  }

  if (salon.planId !== plan.id) await trx('salons').where({ id: salonId }).update({ planId: plan.id });
  await syncSalon(trx, salonId, status, { userId, on: startedOn });
  await logActivity(trx, {
    userId,
    entityType: 'subscriptions',
    entityId: sub.id,
    salonId,
    action: 'created',
    summary: `${salon.name}: ${plan.name}, ${priceBani / 100} RON${cycle === 'one_off' ? '' : ` / ${cycle}`}${status === 'trialing' ? `, trial until ${trialEndsOn ?? 'open'}` : ''}`,
  });
  return sub.id;
}

/** Which changes are allowed from which status. */
const ALLOWED: Record<string, readonly SubStatus[]> = {
  upgrade: ['trialing', 'active', 'past_due', 'paused'],
  downgrade: ['trialing', 'active', 'past_due', 'paused'],
  price_change: ['trialing', 'active', 'past_due', 'paused'],
  pause: ['trialing', 'active', 'past_due'],
  resume: ['paused', 'past_due'],
  cancel: ['trialing', 'active', 'past_due', 'paused'],
  trial_converted: ['trialing'],
  past_due: ['active'],
  end: ['trialing', 'active', 'past_due', 'paused'],
};

/** Plan, price and status changes; each one is kept for the MRR history and the salon's story. */
export async function changeSubscription(
  trx: Knex.Transaction,
  id: string,
  input: z.infer<typeof subscriptionChange>,
  userId?: string | null,
): Promise<void> {
  const sub = await trx('subscriptions').where({ id }).forUpdate().first();
  if (!sub) throw notFound('Subscription');
  if (!ALLOWED[input.kind].includes(sub.status)) {
    throw new HttpError(409, 'invalid_change', `A ${sub.status.replace('_', ' ')} subscription can't be changed this way (${input.kind.replace('_', ' ')}).`);
  }
  const on = input.on ?? today();
  if (on < sub.startedOn) throw new HttpError(400, 'validation', 'The change can’t be before the start.', { on: 'Before the start.' });
  const note = input.note?.trim() ?? '';
  const patch: Row = {};

  switch (input.kind) {
    case 'upgrade':
    case 'downgrade': {
      const plan = await trx('plans').where({ id: input.planId }).first();
      if (!plan) throw new HttpError(400, 'validation', 'This plan does not exist.', { planId: 'Pick a plan.' });
      const cycle: BillingCycle = input.billingCycle ?? sub.billingCycle;
      Object.assign(patch, { planId: plan.id, billingCycle: cycle, priceBani: input.priceBani ?? planPrice(plan, cycle) });
      await trx('salons').where({ id: sub.salonId }).update({ planId: plan.id });
      break;
    }
    case 'price_change':
      Object.assign(patch, { priceBani: input.priceBani, ...(input.billingCycle ? { billingCycle: input.billingCycle } : {}) });
      break;
    case 'pause':
      patch.status = 'paused';
      break;
    case 'resume': {
      // Back to the trial only if it is still running and was never converted.
      const converted = await trx('subscriptionChanges').where({ subscriptionId: id, kind: 'trial_converted' }).first('id');
      patch.status = !converted && sub.trialEndsOn && sub.trialEndsOn >= on ? 'trialing' : 'active';
      break;
    }
    case 'cancel':
      Object.assign(patch, { status: 'canceled', canceledOn: on, cancelReason: note });
      break;
    case 'trial_converted':
      Object.assign(patch, {
        status: 'active',
        ...(input.priceBani !== undefined ? { priceBani: input.priceBani } : {}),
        // Converted before the trial ran out: the trial ends the day before (none if converted on day one).
        ...(!sub.trialEndsOn || sub.trialEndsOn >= on ? { trialEndsOn: addDays(on, -1) < sub.startedOn ? null : addDays(on, -1) } : {}),
      });
      break;
    case 'past_due':
      patch.status = 'past_due';
      break;
    case 'end':
      Object.assign(patch, { status: 'ended', canceledOn: on });
      break;
  }

  const [after] = await trx('subscriptions').where({ id }).update(patch).returning('*');
  await recordChange(trx, sub, after, input.kind, on, note, userId);
  if (after.status !== sub.status) await syncSalon(trx, sub.salonId, after.status, { userId, on, reason: note });

  const salon = await trx('salons').where({ id: sub.salonId }).first('name');
  await logActivity(trx, {
    userId,
    entityType: 'subscriptions',
    entityId: id,
    salonId: sub.salonId,
    action: input.kind,
    summary: `${salon.name}: ${input.kind.replace('_', ' ')}${after.priceBani !== sub.priceBani ? ` (${sub.priceBani / 100} → ${after.priceBani / 100} RON)` : ''}${note ? ` · ${note}` : ''}`,
  });
}

// ---- MRR ----

/** MRR at the end of each month, rebuilt from the change history. */
export async function mrrHistory(k: Db, from: string, to: string): Promise<{ month: string; mrrBani: number; paying: number }[]> {
  const changes = await k('subscriptionChanges')
    .orderBy([{ column: 'subscriptionId' }, { column: 'changedOn' }, { column: 'createdAt' }])
    .select('subscriptionId', 'changedOn', 'toStatus', 'toPriceBani', 'billingCycle');
  const bySub = new Map<string, Row[]>();
  for (const c of changes) bySub.set(c.subscriptionId, [...(bySub.get(c.subscriptionId) ?? []), c]);

  return monthRange(from, to).map((month) => {
    const end = monthEnd(month);
    let mrrBani = 0;
    let paying = 0;
    for (const list of bySub.values()) {
      let state: Row | null = null;
      for (const c of list) if (c.changedOn <= end) state = c;
      if (state && (PAYING_STATUSES as readonly string[]).includes(state.toStatus)) {
        mrrBani += monthlyBani(Number(state.toPriceBani), state.billingCycle);
        paying++;
      }
    }
    return { month, mrrBani, paying };
  });
}

// ---- payments ----

export function paymentRows(k: Db): Knex.QueryBuilder {
  return k('payments as y')
    .join('salons as s', 's.id', 'y.salonId')
    .leftJoin('finTransactions as t', 't.paymentId', 'y.id')
    .select(
      'y.*',
      's.name as salonName',
      't.id as transactionId',
      k.raw(`(y.status = 'due' AND y.due_on < ?::date) as overdue`, [today()]),
    );
}

export async function getPaymentRow(k: Db, id: string): Promise<Row> {
  const row = await paymentRows(k).where('y.id', id).first();
  if (!row) throw notFound('Payment');
  return row;
}

/**
 * Creates the due payments of a month for every paying subscription (idempotent). The billing day
 * is the first paid day (the day after the trial, or the start); quarterly and yearly cycles bill
 * every 3 or 12 months from there.
 */
export async function generatePayments(trx: Knex.Transaction, month: string, userId?: string | null): Promise<number> {
  const subs = await trx('subscriptions as x')
    .join('salons as s', 's.id', 'x.salonId')
    .whereIn('x.status', PAYING_STATUSES)
    .whereNot('x.billingCycle', 'one_off')
    .select('x.*', 's.name as salonName');
  let created = 0;
  for (const sub of subs) {
    const anchor = sub.trialEndsOn ? addDays(sub.trialEndsOn, 1) : sub.startedOn;
    const diff = monthsBetween(monthOf(anchor), month);
    const cycleMonths = CYCLE_MONTHS[sub.billingCycle as BillingCycle];
    if (diff < 0 || diff % cycleMonths !== 0) continue;
    const periodStart = addMonths(anchor, diff);
    const exists = await trx('payments').where({ subscriptionId: sub.id, periodStart, kind: 'subscription' }).first('id');
    if (exists) continue;
    await trx('payments').insert({
      subscriptionId: sub.id,
      salonId: sub.salonId,
      kind: 'subscription',
      periodStart,
      periodEnd: addDays(addMonths(anchor, diff + cycleMonths), -1),
      amountBani: sub.priceBani,
      dueOn: periodStart,
    });
    created++;
  }
  if (created) {
    await logActivity(trx, { userId, entityType: 'payments', action: 'generated', summary: `${created} payments due for ${month}`, data: { month, created } });
  }
  return created;
}

const CATEGORY: Record<string, string> = { subscription: 'Subscriptions', one_off: 'Custom projects', extra_work: 'Extra work' };
const WHAT: Record<string, string> = { subscription: 'subscription', one_off: 'custom project', extra_work: 'extra work' };

/** Marks a payment paid and (by default) adds the income to Finances, in one transaction. */
export async function markPaid(
  trx: Knex.Transaction,
  id: string,
  input: z.infer<typeof markPaidSchema>,
  userId?: string | null,
): Promise<void> {
  const payment = await trx('payments as y').join('salons as s', 's.id', 'y.salonId').where('y.id', id).forUpdate('y').first('y.*', 's.name as salonName');
  if (!payment) throw notFound('Payment');
  if (payment.status === 'paid') throw new HttpError(409, 'already_paid', 'This payment is already marked paid.');
  const paidOn = input.paidOn ?? today();
  await trx('payments')
    .where({ id })
    .update({
      status: 'paid',
      paidOn,
      ...(input.method !== undefined ? { method: input.method } : {}),
      ...(input.invoiceNumber !== undefined ? { invoiceNumber: input.invoiceNumber } : {}),
    });

  if (input.createTransaction !== false) {
    const period = payment.periodStart ? ` (${payment.periodStart} – ${payment.periodEnd ?? ''})` : '';
    await trx('finTransactions').insert({
      type: 'income',
      description: `${payment.salonName}: ${WHAT[payment.kind]}${period}`,
      amountBani: payment.amountBani,
      currency: 'RON',
      date: paidOn,
      category: CATEGORY[payment.kind],
      scope: 'business',
      reference: input.invoiceNumber ?? payment.invoiceNumber ?? '',
      paymentId: id,
    });
  }

  // Paid up: a past-due subscription is active again.
  if (payment.subscriptionId) {
    const sub = await trx('subscriptions').where({ id: payment.subscriptionId }).first('status');
    const stillLate = await trx('payments')
      .where({ subscriptionId: payment.subscriptionId, status: 'due' })
      .where('dueOn', '<', today())
      .first('id');
    if (sub?.status === 'past_due' && !stillLate) {
      await changeSubscription(trx, payment.subscriptionId, { kind: 'resume', on: paidOn, note: 'Paid up' }, userId);
    }
  }

  await logActivity(trx, {
    userId,
    entityType: 'payments',
    entityId: id,
    salonId: payment.salonId,
    action: 'paid',
    summary: `${payment.salonName}: ${payment.amountBani / 100} RON paid on ${paidOn}`,
  });
}

/** Undo "paid" (a mistake): back to due, and the Finances entry it created is removed. */
export async function reopenPayment(trx: Knex.Transaction, id: string, userId?: string | null): Promise<void> {
  const payment = await trx('payments').where({ id }).forUpdate().first();
  if (!payment) throw notFound('Payment');
  if (payment.status !== 'paid') throw new HttpError(409, 'not_paid', 'Only a paid payment can be reopened.');
  await trx('finTransactions').where({ paymentId: id }).delete();
  await trx('payments').where({ id }).update({ status: 'due', paidOn: null });
  await logActivity(trx, { userId, entityType: 'payments', entityId: id, salonId: payment.salonId, action: 'reopened', summary: `${payment.amountBani / 100} RON back to due` });
}

// ---- warnings ----

export interface Warning {
  kind: string;
  severity: 'info' | 'warn' | 'bad';
  message: string;
  salonId?: string;
  salonName?: string;
  subscriptionId?: string;
  paymentId?: string;
  dueOn?: string;
}

/** Everything about money that needs a look: trials ending, late payments, terms ending… */
export async function billingWarnings(k: Db): Promise<Warning[]> {
  const now = today();
  const in14 = addDays(now, 14);
  const in30 = addDays(now, 30);
  const out: Warning[] = [];

  const trials = await subscriptionRows(k).where('x.status', 'trialing').whereNotNull('x.trialEndsOn').where('x.trialEndsOn', '<=', in14);
  for (const t of trials) {
    const late = t.trialEndsOn < now;
    out.push({
      kind: late ? 'trial_over' : 'trial_ending',
      severity: late ? 'bad' : 'warn',
      message: late ? `Trial ended on ${t.trialEndsOn}: convert it or follow up` : `Trial ends on ${t.trialEndsOn}`,
      salonId: t.salonId,
      salonName: t.salonName,
      subscriptionId: t.id,
      dueOn: t.trialEndsOn,
    });
  }

  const overdue = await paymentRows(k).where('y.status', 'due').where('y.dueOn', '<', now).orderBy('y.dueOn');
  for (const p of overdue) {
    out.push({
      kind: 'payment_overdue',
      severity: 'bad',
      message: `${p.amountBani / 100} RON was due on ${p.dueOn}`,
      salonId: p.salonId,
      salonName: p.salonName,
      paymentId: p.id,
      subscriptionId: p.subscriptionId ?? undefined,
      dueOn: p.dueOn,
    });
  }

  const pastDue = await subscriptionRows(k).where('x.status', 'past_due');
  for (const s of pastDue) {
    out.push({ kind: 'past_due', severity: 'bad', message: 'Subscription is past due', salonId: s.salonId, salonName: s.salonName, subscriptionId: s.id });
  }

  const terms = await subscriptionRows(k).whereIn('x.status', LIVE_STATUSES).whereNotNull('x.minTermEndsOn').whereBetween('x.minTermEndsOn', [now, in30]);
  for (const s of terms) {
    out.push({
      kind: 'min_term_ending',
      severity: 'info',
      message: `Minimum term ends on ${s.minTermEndsOn}: time to talk about renewal`,
      salonId: s.salonId,
      salonName: s.salonName,
      subscriptionId: s.id,
      dueOn: s.minTermEndsOn,
    });
  }

  const unbilled = await k('salons as s')
    .whereIn('s.status', ['trial', 'active'])
    .whereNotExists(k('subscriptions as x').whereRaw('x.salon_id = s.id').whereIn('x.status', LIVE_STATUSES))
    .select('s.id', 's.name', 's.status');
  for (const s of unbilled) {
    out.push({
      kind: 'no_subscription',
      severity: 'warn',
      message: `Salon is ${s.status} but has no subscription`,
      salonId: s.id,
      salonName: s.name,
    });
  }

  const earlyBird = await k('promotions as pr')
    .where('pr.code', 'early_bird')
    .first('pr.maxSalons', k.raw('(SELECT count(*)::int FROM subscriptions x WHERE x.promotion_id = pr.id) as used'));
  if (earlyBird?.maxSalons) {
    const left = earlyBird.maxSalons - earlyBird.used;
    if (left <= 5) {
      out.push({
        kind: 'early_bird_low',
        severity: left === 0 ? 'bad' : 'warn',
        message: left === 0 ? `All ${earlyBird.maxSalons} Early Bird places are taken` : `Only ${left} Early Bird places left`,
      });
    }
  }

  const order = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity] || String(a.dueOn ?? '').localeCompare(String(b.dueOn ?? '')));
}
