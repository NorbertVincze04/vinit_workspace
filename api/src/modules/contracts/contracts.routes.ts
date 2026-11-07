import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { HttpError, notFound } from '../../http/errors.js';
import { parseBody, parseParams, parseQuery } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { addDays, today } from '../../lib/dates.js';
import { longText, optionalDate, text, uuid, uuidParams } from '../../lib/schemas.js';
import { startOnboarding } from '../onboarding/onboarding.service.js';
import { addOverviewPart } from '../salons/salons.routes.js';

type Db = Knex | Knex.Transaction;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const KINDS = ['subscription', 'custom_project', 'dpa', 'addendum'] as const;
const STATUSES = ['draft', 'sent', 'signed', 'expired', 'terminated'] as const;

const fields = z.object({
  kind: z.enum(KINDS),
  number: text(60),
  status: z.enum(STATUSES),
  signedOn: optionalDate,
  startsOn: optionalDate,
  endsOn: optionalDate,
  renewalOn: optionalDate,
  autoRenew: z.boolean(),
  notes: longText,
});
const createSchema = fields.partial().extend({ salonId: uuid, id: uuid.optional() }).strict();
const patchSchema = fields.partial().strict();
const listQuery = z.object({ salonId: uuid.optional(), status: z.enum(STATUSES).optional(), kind: z.enum(KINDS).optional() });

function contractRows(k: Db): Knex.QueryBuilder {
  return k('contracts as ct')
    .join('salons as s', 's.id', 'ct.salonId')
    .leftJoin('clients as c', 'c.id', 'ct.clientId')
    .select('ct.*', 's.name as salonName', 'c.name as clientName', k.raw('(SELECT count(*)::int FROM files f WHERE f.contract_id = ct.id) as files'));
}

async function getContract(k: Db, id: string): Promise<Row> {
  const row = await contractRows(k).where('ct.id', id).first();
  if (!row) throw notFound('Contract');
  return row;
}

/** "VIN-2026-007": the next number of the year. */
async function nextNumber(trx: Knex.Transaction, on: string): Promise<string> {
  const year = on.slice(0, 4);
  const rows = await trx('contracts').where('number', 'like', `VIN-${year}-%`).select('number');
  const max = rows.reduce((m: number, r: Row) => Math.max(m, Number(String(r.number).split('-')[2]) || 0), 0);
  return `VIN-${year}-${String(max + 1).padStart(3, '0')}`;
}

/** Signed needs a signing date (today by default). */
function withSigning(patch: Row, current?: Row): Row {
  const status = patch.status ?? current?.status;
  if (['signed', 'expired', 'terminated'].includes(status) && !patch.signedOn && !current?.signedOn) return { ...patch, signedOn: today() };
  return patch;
}

/**
 * A subscription contract just got signed: the salon is stamped as signed and its onboarding starts
 * (the 48h clock still waits for the client's materials).
 */
async function onSigned(trx: Knex.Transaction, contract: Row, userId?: string | null): Promise<void> {
  if (contract.kind !== 'subscription') return;
  const signedAt = new Date(`${contract.signedOn}T12:00:00+02:00`).toISOString();
  const salon = await trx('salons').where({ id: contract.salonId }).first('signedAt');
  if (!salon.signedAt) await trx('salons').where({ id: contract.salonId }).update({ signedAt });
  if (!(await trx('onboardings').where({ salonId: contract.salonId }).first('id'))) {
    await startOnboarding(trx, contract.salonId, { signedAt }, userId);
  }
}

/** Per salon on the platform: signed subscription contract? signed DPA? renewal coming up? */
async function compliance(k: Db): Promise<Row[]> {
  const soon = addDays(today(), 30);
  return k('salons as s')
    .whereIn('s.status', ['trial', 'active', 'paused'])
    .orderBy('s.name')
    .select(
      's.id as salonId',
      's.name as salonName',
      's.status as salonStatus',
      k.raw(`(SELECT max(signed_on) FROM contracts ct WHERE ct.salon_id = s.id AND ct.kind = 'subscription' AND ct.status = 'signed') as contract_signed_on`),
      k.raw(`(SELECT max(signed_on) FROM contracts ct WHERE ct.salon_id = s.id AND ct.kind = 'dpa' AND ct.status = 'signed') as dpa_signed_on`),
      k.raw(`(SELECT min(renewal_on) FROM contracts ct WHERE ct.salon_id = s.id AND ct.status = 'signed' AND ct.renewal_on BETWEEN ?::date AND ?::date) as renewal_on`, [today(), soon]),
    );
}

addOverviewPart('contracts', async (k, salon) => {
  const id = salon['id'] as string;
  const [contracts, files] = await Promise.all([
    contractRows(k).where('ct.salonId', id).orderBy([{ column: 'ct.signedOn', order: 'desc', nulls: 'first' }, { column: 'ct.createdAt', order: 'desc' }]),
    k('files').where({ salonId: id }).orderBy('createdAt', 'desc').select('id', 'name', 'mime', 'sizeBytes', 'kind', 'contractId', 'createdAt'),
  ]);
  const signed = (kind: string) => contracts.find((c: Row) => c.kind === kind && c.status === 'signed')?.signedOn ?? null;
  return { contracts, files, contractSignedOn: signed('subscription'), dpaSignedOn: signed('dpa') };
});

/** /contracts — contracts, DPAs and their files; compliance per salon. */
export function contractsRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { salonId, status, kind } = parseQuery(listQuery, req);
    const q = contractRows(db).orderBy('s.name').orderBy('ct.createdAt', 'desc');
    if (salonId) q.where('ct.salonId', salonId);
    if (status) q.where('ct.status', status);
    if (kind) q.where('ct.kind', kind);
    res.json({ items: await q });
  });

  router.get('/compliance', async (_req, res) => {
    res.json({ items: await compliance(db) });
  });

  router.post('/', async (req, res) => {
    const input = withSigning(parseBody(createSchema, req));
    const item = await db.transaction(async (trx) => {
      const salon = await trx('salons').where({ id: input.salonId }).first('id', 'name', 'clientId');
      if (!salon) throw new HttpError(400, 'validation', 'This salon does not exist.', { salonId: 'Pick a salon.' });
      const number = input.number?.trim() || (await nextNumber(trx, input.signedOn ?? today()));
      const [row] = await trx('contracts').insert({ ...input, number, clientId: salon.clientId }).returning('*');
      if (row.status === 'signed') await onSigned(trx, row, req.user?.id);
      await logActivity(trx, { userId: req.user?.id, entityType: 'contracts', entityId: row.id, salonId: salon.id, action: 'created', summary: `${salon.name}: ${row.kind.replace('_', ' ')} ${number} (${row.status})` });
      return getContract(trx, row.id);
    });
    res.status(201).json({ item });
  });

  router.get('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const [item, files] = await Promise.all([
      getContract(db, id),
      db('files').where({ contractId: id }).orderBy('createdAt', 'desc').select('id', 'name', 'mime', 'sizeBytes', 'kind', 'createdAt'),
    ]);
    res.json({ item, files });
  });

  router.patch('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const patch = parseBody(patchSchema, req);
    const item = await db.transaction(async (trx) => {
      const current = await trx('contracts').where({ id }).forUpdate().first();
      if (!current) throw notFound('Contract');
      const next = withSigning(patch, current);
      const [row] = Object.keys(next).length ? await trx('contracts').where({ id }).update(next).returning('*') : [current];
      if (row.status === 'signed' && current.status !== 'signed') await onSigned(trx, row, req.user?.id);
      const changed = patch.status && patch.status !== current.status;
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'contracts',
        entityId: id,
        salonId: current.salonId,
        action: changed ? 'status_changed' : 'updated',
        summary: `${current.kind.replace('_', ' ')} ${current.number}${changed ? `: ${current.status} → ${patch.status}` : ''}`,
      });
      return getContract(trx, id);
    });
    res.json({ item });
  });

  router.delete('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    await db.transaction(async (trx) => {
      const [row] = await trx('contracts').where({ id }).delete().returning('*');
      if (!row) throw notFound('Contract');
      await logActivity(trx, { userId: req.user?.id, entityType: 'contracts', entityId: id, salonId: row.salonId, action: 'deleted', summary: `${row.kind} ${row.number}` });
    });
    res.status(204).end();
  });

  return router;
}
