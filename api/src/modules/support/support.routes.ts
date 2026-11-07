import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { HttpError, notFound } from '../../http/errors.js';
import { parseBody, parseParams, parseQuery } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { addDays, today } from '../../lib/dates.js';
import { isoDate, longText, text, uuid, uuidParams, uuidRef } from '../../lib/schemas.js';
import { addOverviewPart } from '../salons/salons.routes.js';
import { addSalonColumns } from '../salons/salons.service.js';

type Db = Knex | Knex.Transaction;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const TICKET_TYPES = ['bug', 'change_request', 'question'] as const;
const TICKET_STATUSES = ['open', 'in_progress', 'waiting_client', 'resolved', 'closed'] as const;
const OPEN_STATUSES = ['open', 'in_progress', 'waiting_client'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
const CHANNELS = ['whatsapp', 'phone', 'email', 'instagram', 'in_person', 'other'] as const;
const ENTRY_KINDS = ['included_session', 'billable', 'internal'] as const;

const ticketFields = z.object({
  title: z.string().trim().min(1, 'Write a short title.').max(300),
  description: longText,
  type: z.enum(TICKET_TYPES),
  status: z.enum(TICKET_STATUSES),
  priority: z.enum(PRIORITIES),
  reportedVia: z.enum(CHANNELS),
  assigneeId: uuidRef,
});
const ticketCreate = ticketFields.partial().required({ title: true }).extend({ salonId: uuid, id: uuid.optional() }).strict();
const ticketPatch = ticketFields.partial().strict();

const entryFields = z.object({
  ticketId: uuidRef,
  onboardingId: uuidRef,
  workedOn: isoDate,
  minutes: z.number().int('Whole minutes.').min(1, 'At least 1 minute.').max(1440, 'At most 24 hours.'),
  kind: z.enum(ENTRY_KINDS),
  rateBani: z.number().int().min(0).max(10_000_000),
  description: text(2000),
});
const entryCreate = entryFields.partial().required({ minutes: true, kind: true }).extend({ salonId: uuid }).strict();
const entryPatch = entryFields.partial().strict();

const ticketQuery = z.object({
  salonId: uuid.optional(),
  status: z.enum([...TICKET_STATUSES, 'open_all']).optional(),
  type: z.enum(TICKET_TYPES).optional(),
});
const entryQuery = z.object({ salonId: uuid.optional(), ticketId: uuid.optional(), from: isoDate.optional(), to: isoDate.optional() });
const billSchema = z.object({ dueOn: isoDate.optional() }).strict();

// ---- queries ----

function ticketRows(k: Db): Knex.QueryBuilder {
  return k('tickets as t')
    .join('salons as s', 's.id', 't.salonId')
    .leftJoin('users as u', 'u.id', 't.assigneeId')
    .select(
      't.*',
      's.name as salonName',
      'u.fullName as assigneeName',
      k.raw('(SELECT coalesce(sum(e.minutes), 0)::int FROM time_entries e WHERE e.ticket_id = t.id) as minutes_logged'),
    );
}

async function getTicket(k: Db, id: string): Promise<Row> {
  const row = await ticketRows(k).where('t.id', id).first();
  if (!row) throw notFound('Ticket');
  return row;
}

function entryRows(k: Db): Knex.QueryBuilder {
  return k('timeEntries as e')
    .join('salons as s', 's.id', 'e.salonId')
    .leftJoin('tickets as t', 't.id', 'e.ticketId')
    .leftJoin('users as u', 'u.id', 'e.userId')
    .select(
      'e.*',
      's.name as salonName',
      't.number as ticketNumber',
      't.title as ticketTitle',
      'u.fullName as userName',
      k.raw('round(e.minutes * e.rate_bani / 60.0)::int as amount_bani'),
    );
}

/** Included sessions (per meeting, one-time per contract) and unbilled extra work of a salon. */
export async function sessionSummary(k: Db, salonId: string): Promise<Row> {
  const salon = await k('salons as s').leftJoin('plans as p', 'p.id', 's.planId').where('s.id', salonId).first('s.id', 'p.includedSessions', 'p.sessionMinutes', 'p.extraHourlyBani', 'p.name as planName');
  if (!salon) throw notFound('Salon');
  const [totals] = await k('timeEntries')
    .where({ salonId })
    .select(
      k.raw(`count(*) FILTER (WHERE kind = 'included_session')::int as used`),
      k.raw(`coalesce(sum(minutes) FILTER (WHERE kind = 'included_session'), 0)::int as session_minutes_used`),
      k.raw(`coalesce(sum(minutes) FILTER (WHERE kind = 'billable' AND billed_payment_id IS NULL), 0)::int as unbilled_minutes`),
      k.raw(`coalesce(sum(round(minutes * rate_bani / 60.0)) FILTER (WHERE kind = 'billable' AND billed_payment_id IS NULL), 0)::int as unbilled_bani`),
      k.raw(`coalesce(sum(minutes) FILTER (WHERE kind = 'billable'), 0)::int as billable_minutes`),
      k.raw(`coalesce(sum(minutes) FILTER (WHERE kind = 'internal'), 0)::int as internal_minutes`),
    );
  const included = Number(salon.includedSessions ?? 0);
  return {
    planName: salon.planName ?? null,
    included,
    used: totals.used,
    remaining: Math.max(0, included - totals.used),
    sessionMinutes: Number(salon.sessionMinutes ?? 30),
    extraHourlyBani: Number(salon.extraHourlyBani ?? 10000),
    sessionMinutesUsed: totals.sessionMinutesUsed,
    unbilledMinutes: totals.unbilledMinutes,
    unbilledBani: totals.unbilledBani,
    billableMinutes: totals.billableMinutes,
    internalMinutes: totals.internalMinutes,
  };
}

/** Timestamps that follow the status: resolved_at / closed_at, cleared when reopened. */
function statusStamps(from: string, to: string | undefined): Row {
  if (!to || to === from) return {};
  if (to === 'resolved') return { resolvedAt: db.fn.now(), closedAt: null };
  if (to === 'closed') return from === 'resolved' ? { closedAt: db.fn.now() } : { resolvedAt: db.fn.now(), closedAt: db.fn.now() };
  return { resolvedAt: null, closedAt: null };
}

// ---- other modules ----

addSalonColumns((q, k) => {
  q.select(k.raw(`(SELECT count(*)::int FROM tickets tk WHERE tk.salon_id = s.id AND tk.status IN ('open', 'in_progress', 'waiting_client')) as open_tickets`));
});

addOverviewPart('support', async (k, salon) => {
  const id = salon['id'] as string;
  const [sessions, tickets, entries] = await Promise.all([
    sessionSummary(k, id),
    ticketRows(k).where('t.salonId', id).orderByRaw(`(t.status IN ('open', 'in_progress', 'waiting_client')) DESC`).orderBy('t.openedAt', 'desc').limit(50),
    entryRows(k).where('e.salonId', id).orderBy([{ column: 'e.workedOn', order: 'desc' }, { column: 'e.createdAt', order: 'desc' }]).limit(100),
  ]);
  return { sessions, tickets, entries };
});

// ---- routes ----

/** /tickets, /time-entries, /salons/:id/sessions, /salons/:id/bill-extra-work */
export function supportRouter(): Router {
  const router = Router();

  router.get('/tickets', async (req, res) => {
    const { salonId, status, type } = parseQuery(ticketQuery, req);
    const q = ticketRows(db).orderByRaw(`array_position(array['urgent','high','normal','low'], t.priority)`).orderBy('t.openedAt', 'desc');
    if (salonId) q.where('t.salonId', salonId);
    if (status === 'open_all') q.whereIn('t.status', OPEN_STATUSES);
    else if (status) q.where('t.status', status);
    if (type) q.where('t.type', type);
    res.json({ items: await q });
  });

  router.post('/tickets', async (req, res) => {
    const data = parseBody(ticketCreate, req);
    const item = await db.transaction(async (trx) => {
      const salon = await trx('salons').where({ id: data.salonId }).first('id', 'name');
      if (!salon) throw new HttpError(400, 'validation', 'This salon does not exist.', { salonId: 'Pick a salon.' });
      const [row] = await trx('tickets')
        .insert({ ...data, assigneeId: data.assigneeId === undefined ? (req.user?.id ?? null) : data.assigneeId, ...statusStamps('open', data.status) })
        .returning('*');
      await logActivity(trx, { userId: req.user?.id, entityType: 'tickets', entityId: row.id, salonId: salon.id, action: 'created', summary: `T-${String(row.number).padStart(4, '0')} ${row.title}` });
      return getTicket(trx, row.id);
    });
    res.status(201).json({ item });
  });

  router.get('/tickets/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const [item, entries] = await Promise.all([
      getTicket(db, id),
      entryRows(db).where('e.ticketId', id).orderBy([{ column: 'e.workedOn', order: 'desc' }, { column: 'e.createdAt', order: 'desc' }]),
    ]);
    res.json({ item, entries });
  });

  router.patch('/tickets/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const patch = parseBody(ticketPatch, req);
    const item = await db.transaction(async (trx) => {
      const current = await trx('tickets').where({ id }).forUpdate().first();
      if (!current) throw notFound('Ticket');
      await trx('tickets').where({ id }).update({ ...patch, ...statusStamps(current.status, patch.status) });
      const label = `T-${String(current.number).padStart(4, '0')} ${patch.title ?? current.title}`;
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'tickets',
        entityId: id,
        salonId: current.salonId,
        action: patch.status && patch.status !== current.status ? 'status_changed' : 'updated',
        summary: patch.status && patch.status !== current.status ? `${label}: ${current.status} → ${patch.status}` : label,
        data: { fields: Object.keys(patch) },
      });
      return getTicket(trx, id);
    });
    res.json({ item });
  });

  router.delete('/tickets/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    await db.transaction(async (trx) => {
      const [row] = await trx('tickets').where({ id }).delete().returning('*');
      if (!row) throw notFound('Ticket');
      await logActivity(trx, { userId: req.user?.id, entityType: 'tickets', entityId: id, salonId: row.salonId, action: 'deleted', summary: `T-${String(row.number).padStart(4, '0')} ${row.title}` });
    });
    res.status(204).end();
  });

  router.get('/time-entries', async (req, res) => {
    const { salonId, ticketId, from, to } = parseQuery(entryQuery, req);
    const q = entryRows(db).orderBy([{ column: 'e.workedOn', order: 'desc' }, { column: 'e.createdAt', order: 'desc' }]).limit(1000);
    if (salonId) q.where('e.salonId', salonId);
    if (ticketId) q.where('e.ticketId', ticketId);
    if (from) q.where('e.workedOn', '>=', from);
    if (to) q.where('e.workedOn', '<=', to);
    res.json({ items: await q });
  });

  router.post('/time-entries', async (req, res) => {
    const data = parseBody(entryCreate, req);
    const item = await db.transaction(async (trx) => {
      // One writer at a time per salon, so two people can't both take the last included session.
      const salon = await trx('salons').where({ id: data.salonId }).forUpdate().first('id', 'name');
      if (!salon) throw new HttpError(400, 'validation', 'This salon does not exist.', { salonId: 'Pick a salon.' });
      if (data.ticketId) {
        const ticket = await trx('tickets').where({ id: data.ticketId }).first('salonId');
        if (ticket?.salonId !== data.salonId) throw new HttpError(400, 'validation', 'The ticket belongs to another salon.', { ticketId: 'Not this salon’s.' });
      }
      if (data.onboardingId) {
        const ob = await trx('onboardings').where({ id: data.onboardingId }).first('salonId');
        if (ob?.salonId !== data.salonId) throw new HttpError(400, 'validation', 'The onboarding belongs to another salon.', { onboardingId: 'Not this salon’s.' });
      }
      const sessions = await sessionSummary(trx, data.salonId);
      if (data.kind === 'included_session' && sessions.remaining <= 0) {
        throw new HttpError(
          409,
          'no_sessions_left',
          `All ${sessions.included} included sessions are used. Log this one as billable (${sessions.extraHourlyBani / 100} RON/h).`,
        );
      }
      const rateBani = data.rateBani ?? (data.kind === 'billable' ? sessions.extraHourlyBani : 0);
      const [row] = await trx('timeEntries').insert({ ...data, rateBani, userId: req.user?.id ?? null }).returning('*');
      const what = data.kind === 'included_session' ? `included session ${sessions.used + 1} of ${sessions.included}` : data.kind;
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'time-entries',
        entityId: row.id,
        salonId: data.salonId,
        action: 'created',
        summary: `${salon.name}: ${data.minutes} min (${what})${data.description ? ` · ${data.description.slice(0, 80)}` : ''}`,
      });
      return entryRows(trx).where('e.id', row.id).first();
    });
    res.status(201).json({ item });
  });

  router.patch('/time-entries/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const patch = parseBody(entryPatch, req);
    const item = await db.transaction(async (trx) => {
      const current = await trx('timeEntries').where({ id }).forUpdate().first();
      if (!current) throw notFound('Time entry');
      if (current.billedPaymentId) throw new HttpError(409, 'billed', 'This time is already billed. Delete the payment first to change it.');
      if (patch.kind === 'included_session' && current.kind !== 'included_session') {
        const sessions = await sessionSummary(trx, current.salonId);
        if (sessions.remaining <= 0) throw new HttpError(409, 'no_sessions_left', `All ${sessions.included} included sessions are used.`);
      }
      if (Object.keys(patch).length) await trx('timeEntries').where({ id }).update(patch);
      return entryRows(trx).where('e.id', id).first();
    });
    res.json({ item });
  });

  router.delete('/time-entries/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    await db.transaction(async (trx) => {
      const current = await trx('timeEntries').where({ id }).forUpdate().first();
      if (!current) throw notFound('Time entry');
      if (current.billedPaymentId) throw new HttpError(409, 'billed', 'This time is already billed. Delete the payment first.');
      await trx('timeEntries').where({ id }).delete();
      await logActivity(trx, { userId: req.user?.id, entityType: 'time-entries', entityId: id, salonId: current.salonId, action: 'deleted', summary: `${current.minutes} min (${current.kind})` });
    });
    res.status(204).end();
  });

  router.get('/salons/:id/sessions', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    res.json(await sessionSummary(db, id));
  });

  /** Unbilled billable time → one "extra work" payment; the entries are linked to it. */
  router.post('/salons/:id/bill-extra-work', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const { dueOn } = parseBody(billSchema, req);
    const payment = await db.transaction(async (trx) => {
      const salon = await trx('salons').where({ id }).forUpdate().first('id', 'name');
      if (!salon) throw notFound('Salon');
      const entries = await trx('timeEntries').where({ salonId: id, kind: 'billable' }).whereNull('billedPaymentId').forUpdate().select('id', 'minutes', 'rateBani', 'workedOn');
      if (!entries.length) throw new HttpError(409, 'nothing_to_bill', 'There is no unbilled extra work for this salon.');
      const amountBani = entries.reduce((sum: number, e: Row) => sum + Math.round((e.minutes * e.rateBani) / 60), 0);
      const minutes = entries.reduce((sum: number, e: Row) => sum + e.minutes, 0);
      const days = entries.map((e: Row) => e.workedOn as string).sort();
      const [row] = await trx('payments')
        .insert({
          salonId: id,
          kind: 'extra_work',
          amountBani,
          dueOn: dueOn ?? addDays(today(), 14),
          periodStart: days[0],
          periodEnd: days.at(-1),
          notes: `${minutes} min of extra work (${entries.length} entries)`,
        })
        .returning('*');
      await trx('timeEntries')
        .whereIn('id', entries.map((e: Row) => e.id))
        .update({ billedPaymentId: row.id });
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'payments',
        entityId: row.id,
        salonId: id,
        action: 'created',
        summary: `${salon.name}: extra work billed, ${minutes} min = ${amountBani / 100} RON`,
      });
      return row;
    });
    res.status(201).json({ item: payment, sessions: await sessionSummary(db, id) });
  });

  return router;
}
