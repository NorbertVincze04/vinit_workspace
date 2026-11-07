import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { HttpError, notFound } from '../../http/errors.js';
import { parseBody, parseParams, parseQuery } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { addMonths, monthOf, today } from '../../lib/dates.js';
import { uuidParams } from '../../lib/schemas.js';
import { setPromotionUsage } from '../salons/plans.routes.js';
import { addOverviewPart } from '../salons/salons.routes.js';
import { addSalonColumns } from '../salons/salons.service.js';
import {
  LIVE_STATUSES,
  generateBody,
  markPaid as markPaidSchema,
  mrrQuery,
  paymentCreate,
  paymentListQuery,
  paymentPatch,
  subscriptionChange,
  subscriptionCreate,
  subscriptionPatch,
} from './billing.schemas.js';
import {
  MRR_SQL,
  billingWarnings,
  changeSubscription,
  createSubscription,
  generatePayments,
  getPaymentRow,
  getSubscriptionRow,
  markPaid,
  mrrHistory,
  paymentRows,
  reopenPayment,
  subscriptionRows,
} from './billing.service.js';

const subscriptionsQuery = z.object({ status: z.enum(['live', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'ended']).optional() });

// ---- what other modules show ----

/** Every salon row carries its running subscription (status, price, MRR, trial end). */
addSalonColumns((q, k) => {
  q.leftJoin('subscriptions as x', function () {
    this.on('x.salonId', '=', 's.id').andOnIn('x.status', [...LIVE_STATUSES]);
  }).select(
    'x.id as subscriptionId',
    'x.status as subscriptionStatus',
    'x.priceBani as subscriptionPriceBani',
    'x.billingCycle as subscriptionCycle',
    'x.trialEndsOn as trialEndsOn',
    k.raw(`coalesce(${MRR_SQL}, 0) as mrr_bani`),
  );
});

/** Promotions list how many subscriptions used them (Early Bird: 50 places). */
setPromotionUsage((k) => k.raw('(SELECT count(*)::int FROM subscriptions x WHERE x.promotion_id = pr.id) as used'));

/** The salon page's "Subscription & payments" tab. */
addOverviewPart('billing', async (k, salon) => {
  const subscriptions = await subscriptionRows(k)
    .where('x.salonId', salon['id'] as string)
    .orderByRaw(`(x.status IN ('trialing', 'active', 'past_due', 'paused')) DESC`)
    .orderBy('x.startedOn', 'desc');
  const changes = subscriptions.length
    ? await k('subscriptionChanges as c')
        .leftJoin('plans as fp', 'fp.id', 'c.fromPlanId')
        .leftJoin('plans as tp', 'tp.id', 'c.toPlanId')
        .leftJoin('users as u', 'u.id', 'c.changedBy')
        .whereIn(
          'c.subscriptionId',
          subscriptions.map((s: { id: string }) => s.id),
        )
        .orderBy([{ column: 'c.changedOn', order: 'desc' }, { column: 'c.createdAt', order: 'desc' }])
        .select('c.*', 'fp.name as fromPlanName', 'tp.name as toPlanName', 'u.fullName as changedByName')
    : [];
  const payments = await paymentRows(k).where('y.salonId', salon['id'] as string).orderBy('y.dueOn', 'desc').limit(60);
  return { subscription: subscriptions[0] ?? null, past: subscriptions.slice(1), changes, payments };
});

// ---- /subscriptions ----

export function subscriptionsRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { status } = parseQuery(subscriptionsQuery, req);
    const q = subscriptionRows(db).orderBy('s.name');
    if (status === 'live') q.whereIn('x.status', LIVE_STATUSES);
    else if (status) q.where('x.status', status);
    res.json({ items: await q });
  });

  router.get('/warnings', async (_req, res) => {
    res.json({ items: await billingWarnings(db) });
  });

  router.get('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    res.json({ item: await getSubscriptionRow(db, id) });
  });

  router.patch('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const patch = parseBody(subscriptionPatch, req);
    const item = await db.transaction(async (trx) => {
      const [row] = Object.keys(patch).length
        ? await trx('subscriptions').where({ id }).update(patch).returning('*')
        : await trx('subscriptions').where({ id }).select('*');
      if (!row) throw notFound('Subscription');
      await logActivity(trx, { userId: req.user?.id, entityType: 'subscriptions', entityId: id, salonId: row.salonId, action: 'updated', summary: 'Subscription details', data: { fields: Object.keys(patch) } });
      return getSubscriptionRow(trx, id);
    });
    res.json({ item });
  });

  router.post('/:id/change', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const input = parseBody(subscriptionChange, req);
    const item = await db.transaction(async (trx) => {
      await changeSubscription(trx, id, input, req.user?.id);
      return getSubscriptionRow(trx, id);
    });
    res.json({ item });
  });

  return router;
}


/** POST /salons/:id/subscriptions (mounted on the salons path). */
export function salonSubscriptionsRouter(): Router {
  const router = Router({ mergeParams: true });
  router.post('/', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const input = parseBody(subscriptionCreate, req);
    const item = await db.transaction(async (trx) => getSubscriptionRow(trx, await createSubscription(trx, id, input, req.user?.id)));
    res.status(201).json({ item });
  });
  return router;
}

// ---- /payments ----

export function paymentsRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { status, salonId } = parseQuery(paymentListQuery, req);
    const q = paymentRows(db).orderBy([{ column: 'y.dueOn', order: 'desc' }, { column: 'y.createdAt', order: 'desc' }]);
    if (status === 'overdue') q.where('y.status', 'due').where('y.dueOn', '<', today());
    else if (status) q.where('y.status', status);
    if (salonId) q.where('y.salonId', salonId);
    res.json({ items: await q });
  });

  router.post('/', async (req, res) => {
    const data = parseBody(paymentCreate, req);
    const item = await db.transaction(async (trx) => {
      const salon = await trx('salons').where({ id: data.salonId }).first('id', 'name');
      if (!salon) throw new HttpError(400, 'validation', 'This salon does not exist.', { salonId: 'Pick a salon.' });
      if (data.subscriptionId) {
        const sub = await trx('subscriptions').where({ id: data.subscriptionId }).first('salonId');
        if (sub?.salonId !== data.salonId) {
          throw new HttpError(400, 'validation', 'The subscription belongs to another salon.', { subscriptionId: 'Not this salon’s.' });
        }
      }
      const [row] = await trx('payments').insert(data).returning('*');
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'payments',
        entityId: row.id,
        salonId: data.salonId,
        action: 'created',
        summary: `${salon.name}: ${data.amountBani / 100} RON due on ${data.dueOn}`,
      });
      return getPaymentRow(trx, row.id);
    });
    res.status(201).json({ item });
  });

  router.post('/generate', async (req, res) => {
    const { month } = parseBody(generateBody, req);
    const created = await db.transaction((trx) => generatePayments(trx, month, req.user?.id));
    res.json({ created });
  });

  router.patch('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const patch = parseBody(paymentPatch, req);
    const item = await db.transaction(async (trx) => {
      const current = await trx('payments').where({ id }).forUpdate().first();
      if (!current) throw notFound('Payment');
      if (current.status === 'paid' && (patch.amountBani !== undefined || patch.status !== undefined)) {
        throw new HttpError(409, 'already_paid', 'Reopen the payment before changing its amount or status.');
      }
      if (Object.keys(patch).length) await trx('payments').where({ id }).update(patch);
      await logActivity(trx, { userId: req.user?.id, entityType: 'payments', entityId: id, salonId: current.salonId, action: 'updated', summary: 'Payment details', data: { fields: Object.keys(patch) } });
      return getPaymentRow(trx, id);
    });
    res.json({ item });
  });

  router.delete('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    await db.transaction(async (trx) => {
      const current = await trx('payments').where({ id }).forUpdate().first();
      if (!current) throw notFound('Payment');
      if (current.status === 'paid') throw new HttpError(409, 'already_paid', 'A paid payment can’t be deleted. Reopen it first.');
      await trx('payments').where({ id }).delete();
      await logActivity(trx, { userId: req.user?.id, entityType: 'payments', entityId: id, salonId: current.salonId, action: 'deleted', summary: `${current.amountBani / 100} RON` });
    });
    res.status(204).end();
  });

  router.post('/:id/mark-paid', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const input = parseBody(markPaidSchema, req);
    const item = await db.transaction(async (trx) => {
      await markPaid(trx, id, input, req.user?.id);
      return getPaymentRow(trx, id);
    });
    res.json({ item });
  });

  router.post('/:id/reopen', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const item = await db.transaction(async (trx) => {
      await reopenPayment(trx, id, req.user?.id);
      return getPaymentRow(trx, id);
    });
    res.json({ item });
  });

  return router;
}

// ---- /metrics ----

export function metricsRouter(): Router {
  const router = Router();
  /** MRR at the end of each month (default: the last 12 months). */
  router.get('/mrr', async (req, res) => {
    const q = parseQuery(mrrQuery, req);
    const to = q.to ?? monthOf(today());
    const from = q.from ?? monthOf(addMonths(`${to}-01`, -11));
    if (from > to) throw new HttpError(400, 'validation', '"from" must be before "to".', { from: 'After "to".' });
    res.json({ items: await mrrHistory(db, from, to) });
  });
  return router;
}
