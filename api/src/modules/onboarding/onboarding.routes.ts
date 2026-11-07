import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { HttpError, notFound } from '../../http/errors.js';
import { parseBody, parseParams, parseQuery } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { longText, text, timestamp, uuidParams } from '../../lib/schemas.js';
import { addOverviewPart } from '../salons/salons.routes.js';
import { addSalonColumns } from '../salons/salons.service.js';
import { startOnboarding } from './onboarding.service.js';

type Db = Knex | Knex.Transaction;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** The promise to every salon: live within 48 hours of receiving its materials. */
export const ONBOARDING_HOURS = 48;

const CATEGORIES = ['materials', 'session', 'setup', 'launch'] as const;

const startSchema = z
  .object({
    signedAt: timestamp.optional(),
    materialsReceivedAt: timestamp.nullable().optional(),
    notes: longText.optional(),
  })
  .strict();

const patchSchema = z
  .object({
    signedAt: timestamp,
    materialsReceivedAt: timestamp.nullable(),
    status: z.enum(['in_progress', 'blocked']),
    blockedReason: text(1000),
    notes: longText,
  })
  .partial()
  .strict()
  .refine((v) => v.status !== 'blocked' || !!v.blockedReason?.trim(), { message: 'Say what blocks it.', path: ['blockedReason'] });

const stepPatch = z
  .object({ done: z.boolean(), note: text(1000), title: z.string().trim().min(1).max(300) })
  .partial()
  .strict();

const stepCreate = z
  .object({ title: z.string().trim().min(1, 'Write the step.').max(300), category: z.enum(CATEGORIES).optional(), description: text(1000).optional() })
  .strict();

const goLiveSchema = z.object({ wentLiveAt: timestamp.optional() }).strict();

const templateSchema = z
  .object({
    items: z
      .array(z.object({ title: z.string().trim().min(1, 'Every step needs a title.').max(300), description: text(1000).optional(), category: z.enum(CATEGORIES) }).strict())
      .min(1, 'Keep at least one step.')
      .max(100),
  })
  .strict();

const listQuery = z.object({ open: z.enum(['true', 'false']).optional() });

/**
 * Onboarding rows with the 48h clock:
 *   target_live_at = materials received + 48h
 *   hours_used     = hours from materials to go-live (or to now while open)
 *   late           = past the target (open), or went live after it
 */
const CLOCK = `
  (o.materials_received_at + interval '${ONBOARDING_HOURS} hours') as target_live_at,
  CASE WHEN o.materials_received_at IS NULL THEN NULL
       ELSE round(extract(epoch FROM (coalesce(o.went_live_at, now()) - o.materials_received_at)) / 3600.0, 1)::float END as hours_used,
  (o.materials_received_at IS NOT NULL AND coalesce(o.went_live_at, now()) > o.materials_received_at + interval '${ONBOARDING_HOURS} hours') as late,
  round(extract(epoch FROM (coalesce(o.materials_received_at, now()) - o.signed_at)) / 3600.0, 1)::float as hours_waiting_on_client,
  (SELECT count(*)::int FROM onboarding_steps st WHERE st.onboarding_id = o.id) as steps_total,
  (SELECT count(*)::int FROM onboarding_steps st WHERE st.onboarding_id = o.id AND st.done_at IS NOT NULL) as steps_done`;

function onboardingRows(k: Db): Knex.QueryBuilder {
  return k('onboardings as o').join('salons as s', 's.id', 'o.salonId').select('o.*', 's.name as salonName', 's.status as salonStatus', k.raw(CLOCK));
}

async function getOnboarding(k: Db, id: string): Promise<Row> {
  const item = await onboardingRows(k).where('o.id', id).first();
  if (!item) throw notFound('Onboarding');
  const steps = await k('onboardingSteps as st')
    .leftJoin('users as u', 'u.id', 'st.doneBy')
    .where('st.onboardingId', id)
    .orderBy([{ column: 'st.position' }, { column: 'st.createdAt' }])
    .select('st.*', 'u.fullName as doneByName');
  return { ...item, steps };
}

// The salon list shows the onboarding status; the salon page shows the checklist.
addSalonColumns((q, k) => {
  q.leftJoin('onboardings as ob', 'ob.salonId', 's.id').select(
    'ob.id as onboardingId',
    'ob.status as onboardingStatus',
    k.raw(
      `(ob.materials_received_at IS NOT NULL AND coalesce(ob.went_live_at, now()) > ob.materials_received_at + interval '${ONBOARDING_HOURS} hours') as onboarding_late`,
    ),
  );
});

addOverviewPart('onboarding', async (k, salon) => {
  const row = await k('onboardings').where({ salonId: salon['id'] as string }).first('id');
  return row ? getOnboarding(k, row.id) : null;
});

/** POST /salons/:id/onboarding — start it with the template's checklist. */
export function salonOnboardingRouter(): Router {
  const router = Router({ mergeParams: true });
  router.post('/', async (req, res) => {
    const { id: salonId } = parseParams(uuidParams, req);
    const input = parseBody(startSchema, req);
    const item = await db.transaction(async (trx) => getOnboarding(trx, await startOnboarding(trx, salonId, input, req.user?.id)));
    res.status(201).json({ item });
  });
  return router;
}

/** /onboardings, /onboarding-steps, /onboarding-template */
export function onboardingRouter(): Router {
  const router = Router();

  router.get('/onboardings', async (req, res) => {
    const { open } = parseQuery(listQuery, req);
    const q = onboardingRows(db).orderByRaw('o.went_live_at DESC NULLS FIRST').orderBy('o.signedAt');
    if (open === 'true') q.whereNot('o.status', 'done');
    if (open === 'false') q.where('o.status', 'done');
    res.json({ items: await q });
  });

  router.get('/onboardings/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    res.json({ item: await getOnboarding(db, id) });
  });

  router.patch('/onboardings/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const patch: Row = parseBody(patchSchema, req);
    const item = await db.transaction(async (trx) => {
      const current = await trx('onboardings').where({ id }).forUpdate().first();
      if (!current) throw notFound('Onboarding');
      // Back to work after going live (e.g. a mistake): the go-live time is cleared.
      if (patch.status && current.status === 'done') patch.wentLiveAt = null;
      if (patch.status === 'in_progress') patch.blockedReason = '';
      if (Object.keys(patch).length) await trx('onboardings').where({ id }).update(patch);
      const fields = Object.keys(patch);
      const salon = await trx('salons').where({ id: current.salonId }).first('name');
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'onboardings',
        entityId: id,
        salonId: current.salonId,
        action: patch.status === 'blocked' ? 'blocked' : fields.includes('materialsReceivedAt') && patch.materialsReceivedAt ? 'materials_received' : 'updated',
        summary:
          patch.status === 'blocked'
            ? `${salon.name}: onboarding blocked (${patch.blockedReason})`
            : fields.includes('materialsReceivedAt') && patch.materialsReceivedAt
              ? `${salon.name}: materials received, the ${ONBOARDING_HOURS}h clock starts`
              : `${salon.name}: onboarding updated`,
        data: { fields },
      });
      return getOnboarding(trx, id);
    });
    res.json({ item });
  });

  router.post('/onboardings/:id/steps', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const data = parseBody(stepCreate, req);
    const item = await db.transaction(async (trx) => {
      if (!(await trx('onboardings').where({ id }).first('id'))) throw notFound('Onboarding');
      const [{ next }] = await trx('onboardingSteps').where({ onboardingId: id }).select(trx.raw('coalesce(max(position), -1) + 1 as next'));
      await trx('onboardingSteps').insert({ ...data, onboardingId: id, position: next });
      return getOnboarding(trx, id);
    });
    res.status(201).json({ item });
  });

  router.post('/onboardings/:id/go-live', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const { wentLiveAt } = parseBody(goLiveSchema, req);
    const item = await db.transaction(async (trx) => {
      const ob = await trx('onboardings').where({ id }).forUpdate().first();
      if (!ob) throw notFound('Onboarding');
      if (!ob.materialsReceivedAt) {
        throw new HttpError(409, 'no_materials', 'Record when the client’s materials arrived first: the 48h are measured from then.');
      }
      const at = wentLiveAt ?? new Date().toISOString();
      if (new Date(at) < new Date(ob.materialsReceivedAt)) {
        throw new HttpError(400, 'validation', 'Going live can’t be before the materials arrived.', { wentLiveAt: 'Before the materials.' });
      }
      await trx('onboardings').where({ id }).update({ status: 'done', wentLiveAt: at, blockedReason: '' });
      const day = new Date(at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Bucharest' });
      const salon = await trx('salons').where({ id: ob.salonId }).first('name', 'deployStatus', 'goLiveOn');
      await trx('salons')
        .where({ id: ob.salonId })
        .update({ goLiveOn: day, ...(salon.deployStatus !== 'live' ? { deployStatus: 'live', deployedAt: at } : {}) });
      const hours = Math.round(((new Date(at).getTime() - new Date(ob.materialsReceivedAt).getTime()) / 3_600_000) * 10) / 10;
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'onboardings',
        entityId: id,
        salonId: ob.salonId,
        action: 'went_live',
        summary: `${salon.name} is live, ${hours}h after the materials${hours > ONBOARDING_HOURS ? ` (over ${ONBOARDING_HOURS}h)` : ''}`,
        data: { hours },
      });
      return getOnboarding(trx, id);
    });
    res.json({ item });
  });

  router.delete('/onboardings/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    await db.transaction(async (trx) => {
      const [row] = await trx('onboardings').where({ id }).delete().returning('*');
      if (!row) throw notFound('Onboarding');
      await logActivity(trx, { userId: req.user?.id, entityType: 'onboardings', entityId: id, salonId: row.salonId, action: 'deleted', summary: 'Onboarding removed' });
    });
    res.status(204).end();
  });

  router.patch('/onboarding-steps/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const { done, ...rest } = parseBody(stepPatch, req);
    const item = await db.transaction(async (trx) => {
      const step = await trx('onboardingSteps').where({ id }).forUpdate().first();
      if (!step) throw notFound('Step');
      const patch: Row = { ...rest };
      if (done === true && !step.doneAt) Object.assign(patch, { doneAt: trx.fn.now(), doneBy: req.user?.id ?? null });
      if (done === false) Object.assign(patch, { doneAt: null, doneBy: null });
      if (Object.keys(patch).length) await trx('onboardingSteps').where({ id }).update(patch);
      if (done !== undefined && done !== !!step.doneAt) {
        const ob = await trx('onboardings').where({ id: step.onboardingId }).first('salonId');
        await logActivity(trx, {
          userId: req.user?.id,
          entityType: 'onboarding-steps',
          entityId: id,
          salonId: ob.salonId,
          action: done ? 'done' : 'undone',
          summary: `${done ? '✓' : '↺'} ${step.title}`,
        });
      }
      return getOnboarding(trx, step.onboardingId);
    });
    res.json({ item });
  });

  router.delete('/onboarding-steps/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const item = await db.transaction(async (trx) => {
      const [step] = await trx('onboardingSteps').where({ id }).delete().returning('*');
      if (!step) throw notFound('Step');
      return getOnboarding(trx, step.onboardingId);
    });
    res.json({ item });
  });

  router.get('/onboarding-template', async (_req, res) => {
    res.json({ items: await db('onboardingTemplateItems').orderBy('position') });
  });

  /** Replaces the checklist new onboardings start from (running ones keep theirs). */
  router.put('/onboarding-template', async (req, res) => {
    const { items } = parseBody(templateSchema, req);
    const rows = await db.transaction(async (trx) => {
      await trx('onboardingTemplateItems').delete();
      await trx('onboardingTemplateItems').insert(items.map((t, i) => ({ ...t, description: t.description ?? '', position: i })));
      await logActivity(trx, { userId: req.user?.id, entityType: 'onboarding-template', action: 'replaced', summary: `Checklist template: ${items.length} steps` });
      return trx('onboardingTemplateItems').orderBy('position');
    });
    res.json({ items: rows });
  });

  return router;
}
