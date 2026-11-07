import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { HttpError, notFound } from '../../http/errors.js';
import { parseBody, parseParams, parseQuery } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { today } from '../../lib/dates.js';
import { id as textId, longText, optionalDate, text, uuid, uuidParams } from '../../lib/schemas.js';
import { MRR_SQL } from '../billing/billing.service.js';
import { addOverviewPart } from '../salons/salons.routes.js';

type Db = Knex | Knex.Transaction;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const STATUSES = ['new', 'planned', 'in_progress', 'shipped', 'declined'] as const;

const fields = z.object({
  title: z.string().trim().min(1, 'Write a short title.').max(300),
  description: longText,
  status: z.enum(STATUSES),
  roadmapStepId: textId.nullable(),
  shippedOn: optionalDate,
});
const createSchema = fields.partial().required({ title: true }).extend({ id: uuid.optional() }).strict();
const patchSchema = fields.partial().strict();
const voteSchema = z
  .object({ salonId: uuid.optional(), leadId: uuid.optional(), note: text(1000).optional() })
  .strict()
  .refine((v) => !!v.salonId !== !!v.leadId, { message: 'Pick a salon or a lead.', path: ['salonId'] });

/** Requests with their weight: votes, and the MRR of the salons that asked for it. */
function requestRows(k: Db): Knex.QueryBuilder {
  return k('featureRequests as f')
    .leftJoin('roadmapSteps as rs', 'rs.id', 'f.roadmapStepId')
    .select(
      'f.*',
      'rs.text as roadmapStepText',
      'rs.phase as roadmapPhase',
      k.raw('(SELECT count(*)::int FROM feature_votes v WHERE v.feature_request_id = f.id) as votes'),
      k.raw('(SELECT count(*)::int FROM feature_votes v WHERE v.feature_request_id = f.id AND v.salon_id IS NOT NULL) as salon_votes'),
      k.raw(
        `(SELECT coalesce(sum(${MRR_SQL}), 0)::int FROM feature_votes v
           JOIN subscriptions x ON x.salon_id = v.salon_id AND x.status IN ('active', 'past_due')
          WHERE v.feature_request_id = f.id) as mrr_bani`,
      ),
      k.raw('(SELECT count(*)::int FROM tickets t WHERE t.feature_request_id = f.id) as tickets'),
    );
}

async function getRequest(k: Db, id: string): Promise<Row> {
  const item = await requestRows(k).where('f.id', id).first();
  if (!item) throw notFound('Feature request');
  const [votes, tickets] = await Promise.all([
    k('featureVotes as v')
      .leftJoin('salons as s', 's.id', 'v.salonId')
      .leftJoin('leads as l', 'l.id', 'v.leadId')
      .where('v.featureRequestId', id)
      .orderBy('v.createdAt')
      .select('v.*', 's.name as salonName', 's.status as salonStatus', 'l.businessName as leadName', 'l.stage as leadStage'),
    k('tickets as t').join('salons as s', 's.id', 't.salonId').where('t.featureRequestId', id).orderBy('t.number').select('t.id', 't.number', 't.title', 't.status', 's.name as salonName'),
  ]);
  return { ...item, voteList: votes, ticketList: tickets };
}

/** On shipping, the date defaults to today; leaving "shipped" clears it. */
function shippedPatch(patch: Row, current?: Row): Row {
  if (patch.status === 'shipped' && !patch.shippedOn && !current?.shippedOn) return { ...patch, shippedOn: today() };
  if (patch.status && patch.status !== 'shipped') return { ...patch, shippedOn: null };
  return patch;
}

// The salon page lists what this salon asked for.
addOverviewPart('features', async (k, salon) =>
  requestRows(k)
    .whereExists(k('featureVotes as v').whereRaw('v.feature_request_id = f.id').where('v.salonId', salon['id'] as string))
    .orderBy('f.createdAt', 'desc'),
);

/** /feature-requests, /feature-votes, /roadmap-steps, /tickets/:id/to-feature-request */
export function featuresRouter(): Router {
  const router = Router();

  router.get('/roadmap-steps', async (_req, res) => {
    res.json({ items: await db('roadmapSteps').orderBy('position') });
  });

  router.get('/feature-requests', async (req, res) => {
    const { status } = parseQuery(z.object({ status: z.enum([...STATUSES, 'open']).optional() }), req);
    const q = requestRows(db).orderByRaw('mrr_bani DESC, votes DESC').orderBy('f.createdAt', 'desc');
    if (status === 'open') q.whereIn('f.status', ['new', 'planned', 'in_progress']);
    else if (status) q.where('f.status', status);
    res.json({ items: await q });
  });

  router.post('/feature-requests', async (req, res) => {
    const data = parseBody(createSchema, req);
    const item = await db.transaction(async (trx) => {
      const [row] = await trx('featureRequests').insert({ ...shippedPatch(data), createdBy: req.user?.id ?? null }).returning('*');
      await logActivity(trx, { userId: req.user?.id, entityType: 'feature-requests', entityId: row.id, action: 'created', summary: row.title });
      return getRequest(trx, row.id);
    });
    res.status(201).json({ item });
  });

  router.get('/feature-requests/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    res.json({ item: await getRequest(db, id) });
  });

  router.patch('/feature-requests/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const patch = parseBody(patchSchema, req);
    const item = await db.transaction(async (trx) => {
      const current = await trx('featureRequests').where({ id }).forUpdate().first();
      if (!current) throw notFound('Feature request');
      const next = shippedPatch(patch, current);
      if (Object.keys(next).length) await trx('featureRequests').where({ id }).update(next);
      const changed = patch.status && patch.status !== current.status;
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'feature-requests',
        entityId: id,
        action: changed ? 'status_changed' : 'updated',
        summary: changed ? `${current.title}: ${current.status} → ${patch.status}` : current.title,
      });
      // Shipping something salons asked for shows up in each of their stories.
      if (changed && patch.status === 'shipped') {
        const salons = await trx('featureVotes').where({ featureRequestId: id }).whereNotNull('salonId').select('salonId');
        for (const s of salons) {
          await logActivity(trx, { userId: req.user?.id, entityType: 'feature-requests', entityId: id, salonId: s.salonId, action: 'shipped', summary: `Shipped what they asked for: ${current.title}` });
        }
      }
      return getRequest(trx, id);
    });
    res.json({ item });
  });

  router.delete('/feature-requests/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    await db.transaction(async (trx) => {
      const [row] = await trx('featureRequests').where({ id }).delete().returning('*');
      if (!row) throw notFound('Feature request');
      await logActivity(trx, { userId: req.user?.id, entityType: 'feature-requests', entityId: id, action: 'deleted', summary: row.title });
    });
    res.status(204).end();
  });

  router.post('/feature-requests/:id/votes', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const data = parseBody(voteSchema, req);
    const item = await db.transaction(async (trx) => {
      const fr = await trx('featureRequests').where({ id }).first('id', 'title');
      if (!fr) throw notFound('Feature request');
      const dup = await trx('featureVotes')
        .where({ featureRequestId: id })
        .where(data.salonId ? { salonId: data.salonId } : { leadId: data.leadId })
        .first('id');
      if (dup) throw new HttpError(409, 'already_voted', 'This one has already asked for it.');
      await trx('featureVotes').insert({ featureRequestId: id, salonId: data.salonId ?? null, leadId: data.leadId ?? null, note: data.note ?? '' });
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'feature-requests',
        entityId: id,
        salonId: data.salonId ?? null,
        action: 'voted',
        summary: `Asked for: ${fr.title}${data.note ? ` (${data.note})` : ''}`,
      });
      return getRequest(trx, id);
    });
    res.status(201).json({ item });
  });

  router.delete('/feature-votes/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const item = await db.transaction(async (trx) => {
      const [row] = await trx('featureVotes').where({ id }).delete().returning('*');
      if (!row) throw notFound('Vote');
      return getRequest(trx, row.featureRequestId);
    });
    res.json({ item });
  });

  /** A change request from a salon becomes a feature request: the salon's vote and the link come with it. */
  router.post('/tickets/:id/to-feature-request', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const item = await db.transaction(async (trx) => {
      const ticket = await trx('tickets').where({ id }).forUpdate().first();
      if (!ticket) throw notFound('Ticket');
      if (ticket.featureRequestId) throw new HttpError(409, 'conflict', 'This ticket is already linked to a feature request.');
      const [fr] = await trx('featureRequests').insert({ title: ticket.title, description: ticket.description, createdBy: req.user?.id ?? null }).returning('*');
      await trx('featureVotes').insert({ featureRequestId: fr.id, salonId: ticket.salonId, note: `From ticket T-${String(ticket.number).padStart(4, '0')}` });
      await trx('tickets').where({ id }).update({ featureRequestId: fr.id });
      await logActivity(trx, { userId: req.user?.id, entityType: 'feature-requests', entityId: fr.id, salonId: ticket.salonId, action: 'created', summary: `Feature request from T-${String(ticket.number).padStart(4, '0')}: ${fr.title}` });
      return getRequest(trx, fr.id);
    });
    res.status(201).json({ item });
  });

  return router;
}
