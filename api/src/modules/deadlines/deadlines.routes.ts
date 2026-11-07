import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { HttpError, notFound } from '../../http/errors.js';
import { parseBody, parseParams, parseQuery } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { addDays, today } from '../../lib/dates.js';
import { isoDate, longText, uuid, uuidParams, uuidRef } from '../../lib/schemas.js';
import { nextOccurrence, regenerateDeadlines } from './deadlines.service.js';

type Db = Knex | Knex.Transaction;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const CATEGORIES = ['domain_renewal', 'contract_renewal', 'trial_end', 'tax', 'accounting', 'funding', 'service_subscription', 'other'] as const;

const url = z.union([z.literal(''), z.url('Enter a full link, like https://…').max(500)]);
const fields = z.object({
  title: z.string().trim().min(1, 'Write what is due.').max(300),
  category: z.enum(CATEGORIES),
  dueOn: isoDate,
  salonId: uuidRef,
  recurrence: z.enum(['none', 'monthly', 'quarterly', 'yearly']),
  /** All day (reminders at 09:00) or at dueTime, Bucharest time. */
  allDay: z.boolean(),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 14:30.').nullable(),
  /** Minutes before (0 = at the time / on the day at 09:00). */
  reminders: z.array(z.number().int().min(0).max(525600)).max(10),
  url,
  notes: longText,
});
const createSchema = fields.partial().required({ title: true, dueOn: true }).extend({ id: uuid.optional() }).strict();
const patchSchema = fields.partial().extend({ status: z.enum(['open', 'dismissed']) }).partial().strict();
const listQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: z.enum(['open', 'done', 'dismissed']).optional(),
  salonId: uuid.optional(),
});

/** Rows with the salon name and the days left (negative = late). */
function deadlineRows(k: Db): Knex.QueryBuilder {
  return k('deadlines as dl').leftJoin('salons as s', 's.id', 'dl.salonId').select('dl.*', 's.name as salonName', k.raw('(dl.due_on - ?::date) as days_left', [today()]));
}

async function getDeadline(k: Db, id: string): Promise<Row> {
  const row = await deadlineRows(k).where('dl.id', id).first();
  if (!row) throw notFound('Deadline');
  return row;
}

/** Generated deadlines only change their status and notes; the date comes from the source. */
const GENERATED_EDITABLE = new Set(['status', 'notes', 'reminders']);

/** All day ⇔ no time; a timed deadline needs its time. Sorted, unique reminders. */
function normalize(data: Row, current: Row | null = null): Row {
  const out = { ...data };
  if (out.dueTime && out.allDay === undefined) out.allDay = false;
  const allDay = out.allDay ?? current?.allDay ?? true;
  const time = out.dueTime !== undefined ? out.dueTime : (current?.dueTime ?? null);
  if (allDay) {
    if (out.allDay !== undefined || out.dueTime !== undefined) out.dueTime = null;
  } else if (!time) {
    throw new HttpError(400, 'validation', 'Pick a time, or make it an all-day deadline.', { dueTime: 'Pick a time.' });
  }
  if (out.reminders) out.reminders = [...new Set(out.reminders as number[])].sort((a, b) => b - a);
  return out;
}

/** /deadlines — the calendar of everything that is due. */
export function deadlinesRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { from, to, status, salonId } = parseQuery(listQuery, req);
    await regenerateDeadlines(db);
    const q = deadlineRows(db).orderBy([{ column: 'dl.dueOn' }, { column: 'dl.allDay', order: 'desc' }, { column: 'dl.dueTime' }, { column: 'dl.title' }]);
    if (from) q.where('dl.dueOn', '>=', from);
    if (to) q.where('dl.dueOn', '<=', to);
    if (status) q.where('dl.status', status);
    if (salonId) q.where('dl.salonId', salonId);
    res.json({ items: await q });
  });

  /** Open deadlines due within `days` (default 30), plus everything overdue. */
  router.get('/upcoming', async (req, res) => {
    const { days } = parseQuery(z.object({ days: z.coerce.number().int().min(0).max(365).default(30) }), req);
    await regenerateDeadlines(db);
    res.json({
      items: await deadlineRows(db).where('dl.status', 'open').where('dl.dueOn', '<=', addDays(today(), days)).orderBy(['dl.dueOn', { column: 'dl.allDay', order: 'desc' }, 'dl.dueTime']),
    });
  });

  router.post('/regenerate', async (req, res) => {
    const result = await regenerateDeadlines(db);
    await logActivity(db, { userId: req.user?.id, entityType: 'deadlines', action: 'regenerated', summary: `${result.added} added, ${result.removed} removed`, data: result });
    res.json(result);
  });

  router.post('/', async (req, res) => {
    const data = normalize(parseBody(createSchema, req));
    const item = await db.transaction(async (trx) => {
      const [row] = await trx('deadlines').insert(data).returning('*');
      await logActivity(trx, { userId: req.user?.id, entityType: 'deadlines', entityId: row.id, salonId: row.salonId, action: 'created', summary: `${row.title} (${row.dueOn}${row.dueTime ? ' ' + row.dueTime : ''})` });
      return getDeadline(trx, row.id);
    });
    res.status(201).json({ item });
  });

  router.patch('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const patch = parseBody(patchSchema, req);
    const item = await db.transaction(async (trx) => {
      const current = await trx('deadlines').where({ id }).forUpdate().first();
      if (!current) throw notFound('Deadline');
      if (current.sourceType && Object.keys(patch).some((f) => !GENERATED_EDITABLE.has(f))) {
        throw new HttpError(409, 'generated', 'This deadline comes from the data (domain, contract, subscription): change it there.');
      }
      const next: Row = normalize(patch, current);
      if (patch.status === 'open') next.doneAt = null;
      if (Object.keys(next).length) await trx('deadlines').where({ id }).update(next);
      await logActivity(trx, { userId: req.user?.id, entityType: 'deadlines', entityId: id, salonId: current.salonId, action: patch.status === 'dismissed' ? 'dismissed' : 'updated', summary: current.title });
      return getDeadline(trx, id);
    });
    res.json({ item });
  });

  /** Done; a repeating deadline gets its next occurrence. */
  router.post('/:id/done', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const result = await db.transaction(async (trx) => {
      const current = await trx('deadlines').where({ id }).forUpdate().first();
      if (!current) throw notFound('Deadline');
      if (current.status === 'done') throw new HttpError(409, 'already_done', 'Already done.');
      await trx('deadlines').where({ id }).update({ status: 'done', doneAt: trx.fn.now() });
      let next: Row | null = null;
      const nextDue = current.sourceType ? null : nextOccurrence(current.dueOn, current.recurrence);
      if (nextDue) {
        [next] = await trx('deadlines')
          .insert({
            title: current.title,
            category: current.category,
            dueOn: nextDue,
            salonId: current.salonId,
            recurrence: current.recurrence,
            allDay: current.allDay,
            dueTime: current.dueTime,
            reminders: current.reminders,
            url: current.url,
            notes: current.notes,
          })
          .returning('*');
      }
      await logActivity(trx, { userId: req.user?.id, entityType: 'deadlines', entityId: id, salonId: current.salonId, action: 'done', summary: `✓ ${current.title}${nextDue ? ` · next ${nextDue}` : ''}` });
      return { item: await getDeadline(trx, id), next: next ? await getDeadline(trx, next.id) : null };
    });
    res.json(result);
  });

  router.delete('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    await db.transaction(async (trx) => {
      const current = await trx('deadlines').where({ id }).first();
      if (!current) throw notFound('Deadline');
      if (current.sourceType) throw new HttpError(409, 'generated', 'This deadline comes from the data: dismiss it instead.');
      await trx('deadlines').where({ id }).delete();
      await logActivity(trx, { userId: req.user?.id, entityType: 'deadlines', entityId: id, salonId: current.salonId, action: 'deleted', summary: current.title });
    });
    res.status(204).end();
  });

  return router;
}

