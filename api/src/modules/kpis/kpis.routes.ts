import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { HttpError } from '../../http/errors.js';
import { parseParams, parseQuery } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { addMonths, monthOf, today } from '../../lib/dates.js';
import { monthKey } from '../../lib/schemas.js';
import { targetsFor } from '../../lib/targets.js';
import { kpiHistory, monthKpis, rebuildSnapshot } from './kpis.service.js';

/** /kpis — the business at a glance, against the plan's targets. */
export function kpisRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { month } = parseQuery(z.object({ month: monthKey.optional() }), req);
    const m = month ?? monthOf(today());
    res.json({ kpis: await monthKpis(db, m), targets: await targetsFor(db, m) });
  });

  router.get('/history', async (req, res) => {
    const q = parseQuery(z.object({ from: monthKey.optional(), to: monthKey.optional() }), req);
    const to = q.to ?? monthOf(today());
    const from = q.from ?? monthOf(addMonths(`${to}-01`, -11));
    if (from > to) throw new HttpError(400, 'validation', '"from" must be before "to".', { from: 'After "to".' });
    res.json({ items: await kpiHistory(db, from, to), targets: await targetsFor(db) });
  });

  /** Recompute a finished month's frozen figures. */
  router.put('/snapshots/:month', async (req, res) => {
    const { month } = parseParams(z.object({ month: monthKey }), req);
    if (month >= monthOf(today())) throw new HttpError(400, 'validation', 'Only finished months have a snapshot.', { month: 'Not finished yet.' });
    const kpis = await rebuildSnapshot(db, month);
    await logActivity(db, { userId: req.user?.id, entityType: 'kpis', action: 'snapshot_rebuilt', summary: `KPIs of ${month} recomputed` });
    res.json({ kpis });
  });

  return router;
}
