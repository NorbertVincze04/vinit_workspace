import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { db } from '../db/knex.js';
import { notFound } from '../http/errors.js';
import { parseBody, parseParams } from '../http/validate.js';
import { logActivity } from './activity.js';
import { id, timestamp } from './schemas.js';

type Row = Record<string, unknown>;

export interface ResourceDef {
  /** URL segment and activity-log entity type, e.g. "tasks". */
  name: string;
  table: string;
  /**
   * The fields a client may write, without defaults: anything left out on create gets the
   * column's database default, and PATCH only touches the fields that are sent.
   */
  fields: z.ZodObject;
  orderBy: { column: string; order?: 'asc' | 'desc'; nulls?: 'first' | 'last' }[];
  /** Has a `position` column: new records go last, a bulk replace keeps the list order. */
  positioned?: boolean;
  /** Links to other tables. A bulk replace clears links whose target does not exist. */
  refs?: { field: string; table: string }[];
  /** Short text for the activity log. */
  label?: (row: Row) => string;
}

const defaultLabel = (row: Row): string =>
  String(row['name'] || row['title'] || row['text'] || row['description'] || row['category'] || row['id'] || '');

const idParams = z.object({ id });

/** Inserts in chunks so a large backup never exceeds Postgres' parameter limit. */
async function insertAll(trx: Knex.Transaction, table: string, rows: Row[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) await trx(table).insert(rows.slice(i, i + 500));
}

/**
 * Standard endpoints for a simple table:
 *   GET    /           → { items }
 *   POST   /           → { item }     (optional client id, so the app can create offline-first)
 *   PATCH  /:id        → { item }
 *   DELETE /:id        → 204
 *   PUT    /           → { items }    replace everything (backup import), in one transaction
 */
export function resourceRouter(def: ResourceDef): Router {
  const router = Router();
  const label = def.label ?? defaultLabel;
  const writable = def.fields.partial();
  const createSchema = writable.extend({ id: id.optional(), createdAt: timestamp.optional(), updatedAt: timestamp.optional() }).strict();
  const updateSchema = writable.strict();
  const replaceSchema = z
    .object({ items: z.array(createSchema).max(20_000) })
    .strict()
    .refine((v) => {
      const ids = v.items.map((x) => x.id).filter(Boolean);
      return new Set(ids).size === ids.length;
    }, 'Two records have the same id.');

  const ordered = (q: Knex.QueryBuilder): Knex.QueryBuilder => {
    for (const o of def.orderBy) q.orderBy(o.column, o.order ?? 'asc', o.nulls);
    return q.orderBy('id');
  };

  router.get('/', async (_req, res) => {
    res.json({ items: await ordered(db(def.table).select('*')) });
  });

  router.post('/', async (req, res) => {
    const data: Row = parseBody(createSchema, req);
    const item = await db.transaction(async (trx) => {
      if (def.positioned && data['position'] === undefined) {
        const [{ next }] = await trx(def.table).select(trx.raw('coalesce(max(position), -1) + 1 as next'));
        data['position'] = next;
      }
      const [row] = await trx(def.table).insert(data).returning('*');
      await logActivity(trx, { userId: req.user?.id, entityType: def.name, entityId: String(row.id), action: 'created', summary: label(row) });
      return row;
    });
    res.status(201).json({ item });
  });

  router.patch('/:id', async (req, res) => {
    const { id: rowId } = parseParams(idParams, req);
    const patch: Row = parseBody(updateSchema, req);
    const item = await db.transaction(async (trx) => {
      const [row] = Object.keys(patch).length
        ? await trx(def.table).where({ id: rowId }).update(patch).returning('*')
        : await trx(def.table).where({ id: rowId }).select('*');
      if (!row) throw notFound();
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: def.name,
        entityId: rowId,
        action: 'updated',
        summary: label(row),
        data: { fields: Object.keys(patch) },
      });
      return row;
    });
    res.json({ item });
  });

  router.delete('/:id', async (req, res) => {
    const { id: rowId } = parseParams(idParams, req);
    await db.transaction(async (trx) => {
      const [row] = await trx(def.table).where({ id: rowId }).delete().returning('*');
      if (!row) throw notFound();
      await logActivity(trx, { userId: req.user?.id, entityType: def.name, entityId: rowId, action: 'deleted', summary: label(row) });
    });
    res.status(204).end();
  });

  router.put('/', async (req, res) => {
    const { items } = parseBody(replaceSchema, req);
    const rows = await db.transaction(async (trx) => {
      const prepared: Row[] = items.map((item, index) => ({
        ...item,
        ...(def.positioned && item.position === undefined ? { position: index } : {}),
      }));
      // Old backups can point at records that were deleted since: drop those links instead of failing.
      for (const r of def.refs ?? []) {
        const wanted = [...new Set(prepared.map((x) => x[r.field]).filter((v): v is string => typeof v === 'string'))];
        if (!wanted.length) continue;
        const present = new Set((await trx(r.table).whereIn('id', wanted).pluck('id')) as string[]);
        for (const x of prepared) if (typeof x[r.field] === 'string' && !present.has(x[r.field] as string)) x[r.field] = null;
      }
      await trx(def.table).delete();
      await insertAll(trx, def.table, prepared);
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: def.name,
        action: 'replaced',
        summary: `Imported ${prepared.length} ${def.name}`,
        data: { count: prepared.length },
      });
      return ordered(trx(def.table).select('*'));
    });
    res.json({ items: rows });
  });

  return router;
}
