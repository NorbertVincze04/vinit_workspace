import { Router } from 'express';
import type { Knex } from 'knex';
import { db } from '../../db/knex.js';
import { notFound } from '../../http/errors.js';
import { parseBody, parseParams } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { uuidParams } from '../../lib/schemas.js';
import { clientCreate, clientPatch } from './salons.schemas.js';
import { inUse } from './salons.service.js';

type Db = Knex | Knex.Transaction;

/** Clients with their (at most one) salon. */
const clientRows = (k: Db): Knex.QueryBuilder =>
  k('clients as c')
    .leftJoin('salons as s', 's.clientId', 'c.id')
    .select('c.*', 's.id as salonId', 's.name as salonName', 's.status as salonStatus');

async function getClientRow(k: Db, id: string): Promise<Record<string, unknown>> {
  const row = await clientRows(k).where('c.id', id).first();
  if (!row) throw notFound('Client');
  return row;
}

/** /clients — the people and companies that pay. One client has at most one salon. */
export function clientsRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json({ items: await clientRows(db).orderBy('c.name').orderBy('c.id') });
  });

  router.post('/', async (req, res) => {
    const data = parseBody(clientCreate, req);
    const item = await db.transaction(async (trx) => {
      const [row] = await trx('clients').insert(data).returning('*');
      await logActivity(trx, { userId: req.user?.id, entityType: 'clients', entityId: row.id as string, action: 'created', summary: row.name as string });
      return getClientRow(trx, row.id as string);
    });
    res.status(201).json({ item });
  });

  router.get('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    res.json({ item: await getClientRow(db, id) });
  });

  router.patch('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const patch = parseBody(clientPatch, req);
    const item = await db.transaction(async (trx) => {
      const [row] = Object.keys(patch).length
        ? await trx('clients').where({ id }).update(patch).returning('*')
        : await trx('clients').where({ id }).select('*');
      if (!row) throw notFound('Client');
      const full = await getClientRow(trx, id);
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'clients',
        entityId: id,
        // Show up in the salon's story too.
        salonId: (full.salonId as string | null) ?? null,
        action: 'updated',
        summary: row.name as string,
        data: { fields: Object.keys(patch) },
      });
      return full;
    });
    res.json({ item });
  });

  router.delete('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    await db.transaction(async (trx) => {
      const salon = await trx('salons').where({ clientId: id }).first('name');
      if (salon) throw inUse(`This client still has the salon “${salon.name}”. Delete the salon first.`);
      const [row] = await trx('clients').where({ id }).delete().returning('*');
      if (!row) throw notFound('Client');
      await logActivity(trx, { userId: req.user?.id, entityType: 'clients', entityId: id, action: 'deleted', summary: row.name as string });
    });
    res.status(204).end();
  });

  return router;
}
