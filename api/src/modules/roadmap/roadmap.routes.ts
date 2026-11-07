import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { parseBody, parseParams } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { writeSetting } from '../settings/settings.routes.js';

const stepId = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/, 'Invalid step id.');
const salons = z.number().int().min(0).max(500);

async function readState(): Promise<{ done: Record<string, boolean>; salons: number }> {
  // (Not .pluck(): it reads the raw snake_case key before our camelCase mapping runs.)
  const steps = ((await db('roadmap_progress').select('stepId')) as { stepId: string }[]).map((r) => r.stepId);
  const setting = await db('app_settings').where({ key: 'roadmap.salons' }).first('value');
  return { done: Object.fromEntries(steps.map((s) => [s, true])), salons: Number(setting?.value ?? 0) };
}

/**
 * Roadmap progress: which checklist steps are done, plus the manual paying-salons counter.
 *   GET /roadmap                    → { done: { b1: true… }, salons }
 *   PUT /roadmap/steps/:stepId      { done }
 *   PUT /roadmap                    { done, salons }   (backup import)
 */
export function roadmapRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(await readState());
  });

  router.put('/steps/:stepId', async (req, res) => {
    const { stepId: step } = parseParams(z.object({ stepId }), req);
    const { done } = parseBody(z.object({ done: z.boolean() }).strict(), req);
    if (done) {
      await db('roadmap_progress').insert({ stepId: step, doneBy: req.user?.id ?? null }).onConflict('stepId').ignore();
    } else {
      await db('roadmap_progress').where({ stepId: step }).delete();
    }
    await logActivity(db, {
      userId: req.user?.id,
      entityType: 'roadmap',
      entityId: step,
      action: done ? 'step_done' : 'step_reopened',
      summary: `Step ${step}`,
    });
    res.json(await readState());
  });

  router.put('/', async (req, res) => {
    const body = parseBody(z.object({ done: z.record(stepId, z.boolean()), salons }).strict(), req);
    await db.transaction(async (trx) => {
      await trx('roadmap_progress').delete();
      const steps = Object.entries(body.done).filter(([, v]) => v).map(([s]) => ({ stepId: s, doneBy: req.user?.id ?? null }));
      if (steps.length) await trx('roadmap_progress').insert(steps);
      await writeSetting(trx, 'roadmap.salons', body.salons, req.user?.id);
      await logActivity(trx, { userId: req.user?.id, entityType: 'roadmap', action: 'replaced', summary: 'Imported roadmap progress' });
    });
    res.json(await readState());
  });

  return router;
}
