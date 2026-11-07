import { Router } from 'express';
import type { Knex } from 'knex';
import { db } from '../../db/knex.js';
import { notFound } from '../../http/errors.js';
import { parseBody, parseParams } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { uuidParams } from '../../lib/schemas.js';
import { planPatch, promotionCreate, promotionPatch } from './salons.schemas.js';

type Db = Knex | Knex.Transaction;
type Counter = (k: Db) => Knex.Raw;
let promotionUsage: Counter | null = null;

/** The subscriptions module tells promotions how many salons use each one. */
export function setPromotionUsage(counter: Counter): void {
  promotionUsage = counter;
}

const promotionRows = (k: Db): Knex.QueryBuilder =>
  k('promotions as pr').select('pr.*', promotionUsage ? promotionUsage(k) : k.raw('0::int as used'));

/** /plans — Standard, Premium, Custom (seeded; prices and included sessions are editable). */
export function plansRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json({ items: await db('plans').orderByRaw("array_position(array['standard','premium','custom'], code)") });
  });

  router.patch('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const patch = parseBody(planPatch, req);
    const item = await db.transaction(async (trx) => {
      const [row] = Object.keys(patch).length
        ? await trx('plans').where({ id }).update(patch).returning('*')
        : await trx('plans').where({ id }).select('*');
      if (!row) throw notFound('Plan');
      await logActivity(trx, { userId: req.user?.id, entityType: 'plans', entityId: id, action: 'updated', summary: row.name as string, data: patch });
      return row;
    });
    res.json({ item });
  });

  return router;
}

/** /promotions — Early Bird, beta, referral… with how many salons use each. */
export function promotionsRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json({ items: await promotionRows(db).orderBy('pr.createdAt').orderBy('pr.code') });
  });

  router.post('/', async (req, res) => {
    const data = parseBody(promotionCreate, req);
    const item = await db.transaction(async (trx) => {
      const [row] = await trx('promotions').insert(data).returning('*');
      await logActivity(trx, { userId: req.user?.id, entityType: 'promotions', entityId: row.id as string, action: 'created', summary: row.name as string });
      return promotionRows(trx).where('pr.id', row.id).first();
    });
    res.status(201).json({ item });
  });

  router.patch('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const patch = parseBody(promotionPatch, req);
    const item = await db.transaction(async (trx) => {
      const [row] = Object.keys(patch).length
        ? await trx('promotions').where({ id }).update(patch).returning('*')
        : await trx('promotions').where({ id }).select('*');
      if (!row) throw notFound('Promotion');
      await logActivity(trx, { userId: req.user?.id, entityType: 'promotions', entityId: id, action: 'updated', summary: row.name as string });
      return promotionRows(trx).where('pr.id', id).first();
    });
    res.json({ item });
  });

  return router;
}
