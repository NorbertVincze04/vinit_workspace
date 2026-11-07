import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { notFound } from '../../http/errors.js';
import { parseParams, parseQuery } from '../../http/validate.js';
import { uuidParams } from '../../lib/schemas.js';
import { generateNotifications } from './notifications.service.js';

/** /notifications — the signed-in person's own notifications. */
export function notificationsRouter(): Router {
  const router = Router();

  /** Unread first, then the latest read ones. Brings the list up to date first. */
  router.get('/', async (req, res) => {
    const { limit } = parseQuery(z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }), req);
    await generateNotifications(db);
    const items = await db('notifications as n')
      .leftJoin('salons as s', 's.id', 'n.salonId')
      .where('n.userId', req.user!.id)
      .whereNull('n.dismissedAt')
      .orderByRaw('n.read_at IS NULL DESC')
      .orderBy('n.createdAt', 'desc')
      .limit(limit)
      .select('n.id', 'n.kind', 'n.severity', 'n.title', 'n.body', 'n.link', 'n.salonId', 's.name as salonName', 'n.dueOn', 'n.readAt', 'n.createdAt');
    res.json({ items });
  });

  /** Cheap: polled by the bell. */
  router.get('/count', async (req, res) => {
    const [{ unread }] = await db('notifications').where({ userId: req.user!.id }).whereNull('readAt').whereNull('dismissedAt').count({ unread: '*' });
    res.json({ unread: Number(unread) });
  });

  router.post('/read-all', async (req, res) => {
    const n = await db('notifications').where({ userId: req.user!.id }).whereNull('readAt').update({ readAt: db.fn.now() });
    res.json({ updated: n });
  });

  router.post('/refresh', async (_req, res) => {
    res.json({ created: await generateNotifications(db) });
  });

  router.post('/:id/read', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const n = await db('notifications').where({ id, userId: req.user!.id }).update({ readAt: db.raw('coalesce(read_at, now())') });
    if (!n) throw notFound('Notification');
    res.status(204).end();
  });

  router.post('/:id/dismiss', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const n = await db('notifications').where({ id, userId: req.user!.id }).update({ dismissedAt: db.fn.now(), readAt: db.raw('coalesce(read_at, now())') });
    if (!n) throw notFound('Notification');
    res.status(204).end();
  });

  return router;
}
