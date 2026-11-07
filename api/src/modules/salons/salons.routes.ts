import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { notFound } from '../../http/errors.js';
import { parseBody, parseParams, parseQuery } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { uuidParams } from '../../lib/schemas.js';
import {
  SALON_STATUSES,
  domainCreate,
  domainPatch,
  salonCreate,
  salonPatch,
  statusChange,
} from './salons.schemas.js';
import { createSalon, getSalonRow, inUse, makePrimaryDomain, salonRows, setSalonStatus } from './salons.service.js';

type Row = Record<string, unknown>;
type OverviewPart = (k: Knex, salon: Row) => Promise<unknown>;
const overviewParts: [string, OverviewPart][] = [];

/** Lets a module add its block to GET /salons/:id/overview (subscription, onboarding, sessions…). */
export function addOverviewPart(name: string, part: OverviewPart): void {
  overviewParts.push([name, part]);
}

const listQuery = z.object({
  status: z.enum(SALON_STATUSES).optional(),
  q: z.string().max(200).optional(),
});

const isFkViolation = (e: unknown): boolean => (e as { code?: string })?.code === '23503';

/** /salons — the central entity every other module links to. */
export function salonsRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { status, q } = parseQuery(listQuery, req);
    const query = salonRows(db).orderBy('s.name').orderBy('s.id');
    if (status) query.where('s.status', status);
    if (q?.trim()) {
      query.whereRaw(
        `unaccent(concat_ws(' ', s.name, s.city, s.tenant_slug, c.name, c.email, c.phone, d.domain)) ILIKE unaccent(?)`,
        [`%${q.trim()}%`],
      );
    }
    res.json({ items: await query });
  });

  router.post('/', async (req, res) => {
    const input = parseBody(salonCreate, req);
    const item = await db.transaction(async (trx) => getSalonRow(trx, await createSalon(trx, input, req.user?.id)));
    res.status(201).json({ item });
  });

  router.get('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    res.json({ item: await getSalonRow(db, id) });
  });

  router.patch('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const patch = parseBody(salonPatch, req);
    const item = await db.transaction(async (trx) => {
      const [row] = Object.keys(patch).length
        ? await trx('salons').where({ id }).update(patch).returning('*')
        : await trx('salons').where({ id }).select('*');
      if (!row) throw notFound('Salon');
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'salons',
        entityId: id,
        salonId: id,
        action: 'updated',
        summary: row.name as string,
        data: { fields: Object.keys(patch) },
      });
      return getSalonRow(trx, id);
    });
    res.json({ item });
  });

  router.delete('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    try {
      await db.transaction(async (trx) => {
        const [row] = await trx('salons').where({ id }).delete().returning('*');
        if (!row) throw notFound('Salon');
        await logActivity(trx, { userId: req.user?.id, entityType: 'salons', entityId: id, action: 'deleted', summary: row.name as string });
      });
    } catch (e) {
      if (isFkViolation(e)) {
        throw inUse('This salon has subscriptions, payments, tickets or time entries. Mark it churned instead of deleting it.');
      }
      throw e;
    }
    res.status(204).end();
  });

  router.post('/:id/status', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const { status, reason, changedOn } = parseBody(statusChange, req);
    const item = await db.transaction(async (trx) => {
      await setSalonStatus(trx, id, status, { userId: req.user?.id, reason, on: changedOn });
      return getSalonRow(trx, id);
    });
    res.json({ item });
  });

  /** Everything the salon detail page shows, in one request. */
  router.get('/:id/overview', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const salon = await getSalonRow(db, id);
    const [client, domains, history] = await Promise.all([
      db('clients').where({ id: salon.clientId }).first(),
      db('salonDomains').where({ salonId: id }).orderBy([{ column: 'isPrimary', order: 'desc' }, { column: 'domain' }]),
      db('salonStatusHistory as h')
        .leftJoin('users as u', 'u.id', 'h.changedBy')
        .where('h.salonId', id)
        .orderBy([{ column: 'h.changedOn', order: 'desc' }, { column: 'h.createdAt', order: 'desc' }])
        .select('h.*', 'u.fullName as changedByName'),
    ]);
    const extra: Row = {};
    for (const [name, part] of overviewParts) extra[name] = await part(db, salon);
    res.json({ salon, client, domains, history, ...extra });
  });

  router.get('/:id/timeline', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const { limit } = parseQuery(z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }), req);
    const items = await db('activityLog as a')
      .leftJoin('users as u', 'u.id', 'a.userId')
      .where('a.salonId', id)
      .orderBy([{ column: 'a.occurredAt', order: 'desc' }, { column: 'a.id', order: 'desc' }])
      .limit(limit)
      .select('a.id', 'a.occurredAt', 'a.entityType', 'a.entityId', 'a.action', 'a.summary', 'a.data', 'u.fullName as userName');
    res.json({ items });
  });

  // ---- domains of a salon ----

  router.get('/:id/domains', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    res.json({ items: await db('salonDomains').where({ salonId: id }).orderBy([{ column: 'isPrimary', order: 'desc' }, 'domain']) });
  });

  router.post('/:id/domains', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const data = parseBody(domainCreate, req);
    const item = await db.transaction(async (trx) => {
      const salon = await trx('salons').where({ id }).first('id', 'name');
      if (!salon) throw notFound('Salon');
      const hasPrimary = await trx('salonDomains').where({ salonId: id, isPrimary: true }).first('id');
      const wantPrimary = data.isPrimary ?? !hasPrimary;
      const [row] = await trx('salonDomains').insert({ ...data, salonId: id, isPrimary: false }).returning('*');
      if (wantPrimary) await makePrimaryDomain(trx, id, row.id as string);
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'domains',
        entityId: row.id as string,
        salonId: id,
        action: 'created',
        summary: `${salon.name}: ${row.domain}`,
      });
      return trx('salonDomains').where({ id: row.id }).first();
    });
    res.status(201).json({ item });
  });

  return router;
}

/** /domains/:id — edit or remove one domain. */
export function domainsRouter(): Router {
  const router = Router();

  router.patch('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const { isPrimary, ...patch } = parseBody(domainPatch, req);
    const item = await db.transaction(async (trx) => {
      const current = await trx('salonDomains').where({ id }).first();
      if (!current) throw notFound('Domain');
      if (Object.keys(patch).length) await trx('salonDomains').where({ id }).update(patch);
      if (isPrimary === true) await makePrimaryDomain(trx, current.salonId as string, id);
      if (isPrimary === false) await trx('salonDomains').where({ id }).update({ isPrimary: false });
      const row = await trx('salonDomains').where({ id }).first();
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'domains',
        entityId: id,
        salonId: current.salonId as string,
        action: 'updated',
        summary: row.domain as string,
        data: { fields: [...Object.keys(patch), ...(isPrimary === undefined ? [] : ['isPrimary'])] },
      });
      return row;
    });
    res.json({ item });
  });

  router.delete('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    await db.transaction(async (trx) => {
      const [row] = await trx('salonDomains').where({ id }).delete().returning('*');
      if (!row) throw notFound('Domain');
      // Keep one primary domain when there are others left.
      if (row.isPrimary) {
        const next = await trx('salonDomains').where({ salonId: row.salonId }).orderBy('createdAt').first('id');
        if (next) await makePrimaryDomain(trx, row.salonId as string, next.id as string);
      }
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'domains',
        entityId: id,
        salonId: row.salonId as string,
        action: 'deleted',
        summary: row.domain as string,
      });
    });
    res.status(204).end();
  });

  return router;
}
