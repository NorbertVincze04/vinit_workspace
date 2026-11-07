import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { HttpError, notFound } from '../../http/errors.js';
import { parseBody, parseParams } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { monthOf, today } from '../../lib/dates.js';
import { longText, uuid, uuidParams } from '../../lib/schemas.js';
import { GOAL_KEYS, planStart, yearRange } from '../../lib/targets.js';
import { planYears, yearResults } from './plan.service.js';

const yearParams = z.object({ year: z.coerce.number().int().min(1).max(50) });
const count = (max: number) => z.number().int().min(0).max(max).nullable();
const money = z.number().int().min(0).max(100_000_000_000).nullable();

/** Goals: every one optional, null = not set. Money in bani. */
const goalsSchema = z
  .object({
    payingSalons: count(100_000),
    breakEvenSalons: count(100_000),
    mrrBani: money,
    incomeBani: money,
    monthlyCostsBani: money,
    retentionPct: count(100),
    onboardingHours: z.number().int().min(1).max(2000).nullable(),
    smsMonthlyBudget: count(10_000_000),
    operationalCostsBani: money,
    notes: longText,
  })
  .partial()
  .strict();

const month = z.number().int().min(1).max(12);
const phaseFields = z.object({
  name: z.string().trim().min(1, 'Give the phase a name.').max(60),
  monthFrom: month,
  monthTo: month,
  goal: z.string().trim().max(300),
  milestone: z.string().trim().max(300),
  position: z.number().int().min(0).max(1000),
});
const phaseCreate = phaseFields.partial().required({ name: true, monthFrom: true, monthTo: true }).strict();
const phasePatch = phaseFields.partial().strict();
const stepText = z.string().trim().min(1, 'Write the step.').max(300);
const stepParams = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'Invalid step id.') });

const checkMonths = (from: number, to: number): void => {
  if (from > to) throw new HttpError(400, 'validation', 'The phase must end in or after its first month.', { monthTo: 'Must be ≥ the first month.' });
};

/**
 * Year plans — each plan year's goals and roadmap.
 *   GET    /plan/years                    every year with goals, phases, steps (ticks)
 *   GET    /plan/years/:year/results      what actually happened (so far)
 *   POST   /plan/years                    adds the next year (goals and phase outline copied)
 *   PATCH  /plan/years/:year              goals, notes
 *   DELETE /plan/years/:year              only the last one, not started yet
 *   POST   /plan/years/:year/phases       PATCH/DELETE /plan/phases/:id
 *   POST   /plan/phases/:id/steps         PATCH/DELETE /plan/steps/:id
 * Ticking a step stays PUT /roadmap/steps/:id.
 */
export function planRouter(): Router {
  const router = Router();

  router.get('/years', async (_req, res) => {
    res.json(await planYears(db));
  });

  router.get('/years/:year/results', async (req, res) => {
    const { year } = parseParams(yearParams, req);
    if (!(await db('planYears').where({ year }).first())) throw notFound('Year');
    res.json(await yearResults(db, year));
  });

  router.post('/years', async (req, res) => {
    const year = await db.transaction(async (trx) => {
      const last = await trx('planYears').orderBy('year', 'desc').forUpdate().first();
      const next = (last?.year ?? 0) + 1;
      if (next > 50) throw new HttpError(409, 'too_many', 'That is enough years.');
      const copy = last ? Object.fromEntries(GOAL_KEYS.map((key) => [key, last[key]])) : {};
      await trx('planYears').insert({ ...copy, year: next, updatedBy: req.user?.id ?? null });
      if (last) {
        const phases = await trx('roadmapPhases').where({ year: last.year }).orderBy('position');
        if (phases.length) {
          await trx('roadmapPhases').insert(phases.map((p) => ({ year: next, name: p.name, monthFrom: p.monthFrom, monthTo: p.monthTo, goal: p.goal, milestone: '', position: p.position })));
        }
      }
      await logActivity(trx, { userId: req.user?.id, entityType: 'roadmap', entityId: String(next), action: 'created', summary: `Year ${next} plan` });
      return next;
    });
    const all = await planYears(db);
    res.status(201).json({ item: all.items.find((y) => y.year === year) });
  });

  router.patch('/years/:year', async (req, res) => {
    const { year } = parseParams(yearParams, req);
    const patch = parseBody(goalsSchema, req);
    await db.transaction(async (trx) => {
      const n = await trx('planYears').where({ year }).update({ ...patch, updatedBy: req.user?.id ?? null });
      if (!n) throw notFound('Year');
      await logActivity(trx, { userId: req.user?.id, entityType: 'roadmap', entityId: String(year), action: 'updated', summary: `Year ${year} goals`, data: patch });
    });
    const all = await planYears(db);
    res.json({ item: all.items.find((y) => y.year === year) });
  });

  router.delete('/years/:year', async (req, res) => {
    const { year } = parseParams(yearParams, req);
    await db.transaction(async (trx) => {
      const last = await trx('planYears').orderBy('year', 'desc').forUpdate().first();
      if (!last || last.year !== year) throw new HttpError(409, 'not_last', 'Only the last year can be removed.');
      if (year === 1) throw new HttpError(409, 'first_year', 'Year 1 stays.');
      if (yearRange(await planStart(trx), year).from <= monthOf(today())) throw new HttpError(409, 'started', 'This year has started: change its goals instead.');
      const stepIds = await trx('roadmapSteps as s').join('roadmapPhases as p', 'p.id', 's.phaseId').where('p.year', year).select('s.id');
      if (stepIds.length) await trx('roadmapProgress').whereIn('stepId', stepIds.map((s) => s.id)).delete();
      await trx('planYears').where({ year }).delete();
      await logActivity(trx, { userId: req.user?.id, entityType: 'roadmap', entityId: String(year), action: 'deleted', summary: `Year ${year} plan` });
    });
    res.status(204).end();
  });

  router.post('/years/:year/phases', async (req, res) => {
    const { year } = parseParams(yearParams, req);
    const data = parseBody(phaseCreate, req);
    checkMonths(data.monthFrom, data.monthTo);
    const item = await db.transaction(async (trx) => {
      if (!(await trx('planYears').where({ year }).first())) throw notFound('Year');
      const [{ max }] = await trx('roadmapPhases').where({ year }).max({ max: 'position' });
      const [row] = await trx('roadmapPhases').insert({ position: (max ?? -1) + 1, ...data, year }).returning('*');
      await logActivity(trx, { userId: req.user?.id, entityType: 'roadmap', entityId: row.id, action: 'created', summary: `Year ${year}: phase ${row.name}` });
      return row;
    });
    res.status(201).json({ item: { ...item, steps: [] } });
  });

  router.patch('/phases/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const patch = parseBody(phasePatch, req);
    const item = await db.transaction(async (trx) => {
      const current = await trx('roadmapPhases').where({ id }).forUpdate().first();
      if (!current) throw notFound('Phase');
      checkMonths(patch.monthFrom ?? current.monthFrom, patch.monthTo ?? current.monthTo);
      const [row] = await trx('roadmapPhases').where({ id }).update(patch).returning('*');
      await logActivity(trx, { userId: req.user?.id, entityType: 'roadmap', entityId: id, action: 'updated', summary: `Year ${row.year}: phase ${row.name}` });
      return row;
    });
    res.json({ item });
  });

  router.delete('/phases/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    await db.transaction(async (trx) => {
      const current = await trx('roadmapPhases').where({ id }).first();
      if (!current) throw notFound('Phase');
      const stepIds = (await trx('roadmapSteps').where({ phaseId: id }).select('id')).map((s) => s.id);
      if (stepIds.length) await trx('roadmapProgress').whereIn('stepId', stepIds).delete();
      await trx('roadmapPhases').where({ id }).delete();
      await logActivity(trx, { userId: req.user?.id, entityType: 'roadmap', entityId: id, action: 'deleted', summary: `Year ${current.year}: phase ${current.name}` });
    });
    res.status(204).end();
  });

  router.post('/phases/:id/steps', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const { text } = parseBody(z.object({ text: stepText }).strict(), req);
    const item = await db.transaction(async (trx) => {
      const phase = await trx('roadmapPhases').where({ id }).first();
      if (!phase) throw notFound('Phase');
      const [{ max }] = await trx('roadmapSteps').where({ phaseId: id }).max({ max: 'position' });
      const [row] = await trx('roadmapSteps')
        .insert({ id: `s-${randomBytes(6).toString('hex')}`, phaseId: id, text, position: (max ?? -1) + 1 })
        .returning(['id', 'text', 'position', 'phaseId']);
      await logActivity(trx, { userId: req.user?.id, entityType: 'roadmap', entityId: row.id, action: 'created', summary: `Year ${phase.year}: ${text}` });
      return row;
    });
    res.status(201).json({ item: { ...item, done: false } });
  });

  router.patch('/steps/:id', async (req, res) => {
    const { id } = parseParams(stepParams, req);
    const patch = parseBody(z.object({ text: stepText, phaseId: uuid, position: z.number().int().min(0).max(1000) }).partial().strict(), req);
    const item = await db.transaction(async (trx) => {
      const current = await trx('roadmapSteps').where({ id }).forUpdate().first();
      if (!current) throw notFound('Step');
      if (patch.phaseId && !(await trx('roadmapPhases').where({ id: patch.phaseId }).first())) throw notFound('Phase');
      const [row] = await trx('roadmapSteps').where({ id }).update(patch).returning(['id', 'text', 'position', 'phaseId']);
      await logActivity(trx, { userId: req.user?.id, entityType: 'roadmap', entityId: id, action: 'updated', summary: row.text });
      return row;
    });
    res.json({ item });
  });

  router.delete('/steps/:id', async (req, res) => {
    const { id } = parseParams(stepParams, req);
    await db.transaction(async (trx) => {
      const current = await trx('roadmapSteps').where({ id }).first();
      if (!current) throw notFound('Step');
      await trx('roadmapProgress').where({ stepId: id }).delete();
      await trx('roadmapSteps').where({ id }).delete();
      await logActivity(trx, { userId: req.user?.id, entityType: 'roadmap', entityId: id, action: 'deleted', summary: current.text });
    });
    res.status(204).end();
  });

  return router;
}
