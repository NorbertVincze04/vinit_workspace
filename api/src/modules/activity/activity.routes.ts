import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { HttpError } from '../../http/errors.js';
import { parseQuery } from '../../http/validate.js';
import { uuid } from '../../lib/schemas.js';

/** Which entity types belong to which area of the workspace (same split as the sidebar groups). */
export const AREAS: Record<string, readonly string[]> = {
  sales: ['leads', 'marketing/posts', 'clients', 'import'],
  salons: ['salons', 'domains', 'onboardings', 'onboarding-steps', 'onboarding-template', 'tickets', 'time-entries', 'contracts', 'feature-requests'],
  money: ['subscriptions', 'payments', 'plans', 'promotions', 'kpis', 'finances/accounts', 'finances/holdings', 'finances/recurring', 'finances/transactions', 'finances/budgets'],
  planning: ['tasks', 'goals', 'roadmap', 'deadlines', 'setting'],
  operations: ['infra', 'wiki', 'files', 'user'],
};

const query = z.object({
  area: z.enum(['sales', 'salons', 'money', 'planning', 'operations']).optional(),
  userId: uuid.optional(),
  salonId: uuid.optional(),
  /** Cursor from the previous page: "<occurredAt>|<id>". */
  before: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** /activity — everything that happened, newest first. */
export function activityRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { area, userId, salonId, before, limit } = parseQuery(query, req);
    const q = db('activityLog as a')
      .leftJoin('users as u', 'u.id', 'a.userId')
      .leftJoin('salons as s', 's.id', 'a.salonId')
      .orderBy([{ column: 'a.occurredAt', order: 'desc' }, { column: 'a.id', order: 'desc' }])
      .limit(limit + 1)
      .select('a.id', 'a.occurredAt', 'a.entityType', 'a.entityId', 'a.action', 'a.summary', 'a.salonId', 's.name as salonName', 'a.userId', 'u.fullName as userName');
    if (area) q.whereIn('a.entityType', AREAS[area]);
    if (userId) q.where('a.userId', userId);
    if (salonId) q.where('a.salonId', salonId);
    if (before) {
      const [at, id] = before.split('|');
      if (!at || !id || Number.isNaN(Date.parse(at)) || !z.uuid().safeParse(id).success) {
        throw new HttpError(400, 'validation', 'Invalid cursor.', { before: 'Invalid cursor' });
      }
      q.whereRaw('(a.occurred_at, a.id) < (?::timestamptz, ?::uuid)', [at, id]);
    }
    const rows = await q;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    res.json({ items, next: rows.length > limit && last ? `${new Date(last.occurredAt).toISOString()}|${last.id}` : null });
  });

  return router;
}
