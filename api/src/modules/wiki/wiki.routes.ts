import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { HttpError, notFound } from '../../http/errors.js';
import { parseBody, parseParams, parseQuery } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { slug as slugSchema } from '../../lib/schemas.js';

type Db = Knex | Knex.Transaction;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const CATEGORIES = ['onboarding', 'deploy', 'json_schema', 'backups', 'sales', 'other'] as const;
const BODY_MAX = 200_000;

const createSchema = z
  .object({
    title: z.string().trim().min(1, 'Give the page a title.').max(200),
    slug: slugSchema.max(80).optional(),
    category: z.enum(CATEGORIES).optional(),
    bodyMd: z.string().max(BODY_MAX).optional(),
  })
  .strict();

const saveSchema = z
  .object({
    title: z.string().trim().min(1, 'Give the page a title.').max(200),
    category: z.enum(CATEGORIES),
    bodyMd: z.string().max(BODY_MAX),
    /** The revision the editor started from: refused if someone saved in between. */
    baseRevision: z.number().int().min(1).optional(),
  })
  .partial()
  .strict();

const listQuery = z.object({
  q: z.string().max(200).optional(),
  category: z.enum(CATEGORIES).optional(),
  archived: z.enum(['true', 'false']).optional(),
});
const slugParams = z.object({ slug: slugSchema });

/** "Fișă de onboarding!" → "fisa-de-onboarding". */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70)
      .replace(/-+$/, '') || 'page'
  );
}

/** Words of a search box → a prefix tsquery ("onboard sal" → "onboard:* & sal:*"); null when empty. */
export function prefixQuery(q: string): string | null {
  const words = q
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);
  return words.length ? words.map((w) => `${w}:*`).join(' & ') : null;
}

const LIST_COLUMNS = ['p.id', 'p.slug', 'p.title', 'p.category', 'p.revision', 'p.archived', 'p.createdAt', 'p.updatedAt', 'u.fullName as updatedByName'];

async function getPage(k: Db, slug: string): Promise<Row> {
  const row = await k('wikiPages as p').leftJoin('users as u', 'u.id', 'p.updatedBy').where('p.slug', slug).first('p.*', 'u.fullName as updatedByName');
  if (!row) throw notFound('Page');
  delete row.search;
  return row;
}

async function uniqueSlug(trx: Knex.Transaction, base: string): Promise<string> {
  const taken = new Set((await trx('wikiPages').where('slug', 'like', `${base}%`).select('slug')).map((r: Row) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** Saves new content as the next revision (and keeps it in the history). */
async function saveRevision(trx: Knex.Transaction, page: Row, next: { title: string; category: string; bodyMd: string }, userId?: string | null): Promise<void> {
  const revision = page.revision + 1;
  await trx('wikiPages').where({ id: page.id }).update({ ...next, revision, updatedBy: userId ?? null });
  await trx('wikiRevisions').insert({ pageId: page.id, revision, title: next.title, bodyMd: next.bodyMd, editedBy: userId ?? null });
}

/** /wiki — the team's how-tos and SOPs. */
export function wikiRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { q, category, archived } = parseQuery(listQuery, req);
    const query = db('wikiPages as p').leftJoin('users as u', 'u.id', 'p.updatedBy').select(LIST_COLUMNS, db.raw('left(p.body_md, 240) as excerpt'));
    query.where('p.archived', archived === 'true');
    if (category) query.where('p.category', category);
    const tsq = q ? prefixQuery(q) : null;
    if (tsq) {
      query
        .whereRaw(`p.search @@ to_tsquery('simple', ?)`, [tsq])
        .select(db.raw(`ts_headline('simple', unaccent(p.body_md), to_tsquery('simple', ?), 'MaxFragments=1, MaxWords=24, MinWords=8, StartSel=«, StopSel=»') as headline`, [tsq]))
        .orderByRaw(`ts_rank(p.search, to_tsquery('simple', ?)) DESC`, [tsq]);
    } else {
      query.orderBy('p.title');
    }
    res.json({ items: await query });
  });

  router.post('/', async (req, res) => {
    const input = parseBody(createSchema, req);
    const item = await db.transaction(async (trx) => {
      const slug = await uniqueSlug(trx, input.slug ?? slugify(input.title));
      const bodyMd = input.bodyMd ?? '';
      const [row] = await trx('wikiPages')
        .insert({ slug, title: input.title, category: input.category ?? 'other', bodyMd, updatedBy: req.user?.id ?? null })
        .returning('*');
      await trx('wikiRevisions').insert({ pageId: row.id, revision: 1, title: row.title, bodyMd, editedBy: req.user?.id ?? null });
      await logActivity(trx, { userId: req.user?.id, entityType: 'wiki', entityId: row.id, action: 'created', summary: row.title });
      return getPage(trx, slug);
    });
    res.status(201).json({ item });
  });

  router.get('/:slug', async (req, res) => {
    const { slug } = parseParams(slugParams, req);
    res.json({ item: await getPage(db, slug) });
  });

  router.put('/:slug', async (req, res) => {
    const { slug } = parseParams(slugParams, req);
    const input = parseBody(saveSchema, req);
    const item = await db.transaction(async (trx) => {
      const page = await trx('wikiPages').where({ slug }).forUpdate().first();
      if (!page) throw notFound('Page');
      if (input.baseRevision !== undefined && input.baseRevision !== page.revision) {
        throw new HttpError(409, 'edit_conflict', `Someone saved this page while you were editing (now version ${page.revision}). Copy your text, reload and apply it again.`);
      }
      const next = { title: input.title ?? page.title, category: input.category ?? page.category, bodyMd: input.bodyMd ?? page.bodyMd };
      if (next.title !== page.title || next.category !== page.category || next.bodyMd !== page.bodyMd) {
        await saveRevision(trx, page, next, req.user?.id);
        await logActivity(trx, { userId: req.user?.id, entityType: 'wiki', entityId: page.id, action: 'updated', summary: `${next.title} (version ${page.revision + 1})` });
      }
      return getPage(trx, slug);
    });
    res.json({ item });
  });

  /** Archive / unarchive (pages are never deleted: their history stays). */
  router.post('/:slug/archive', async (req, res) => {
    const { slug } = parseParams(slugParams, req);
    const { archived } = parseBody(z.object({ archived: z.boolean() }).strict(), req);
    const [row] = await db('wikiPages').where({ slug }).update({ archived }).returning(['id', 'title']);
    if (!row) throw notFound('Page');
    await logActivity(db, { userId: req.user?.id, entityType: 'wiki', entityId: row.id, action: archived ? 'archived' : 'unarchived', summary: row.title });
    res.json({ item: await getPage(db, slug) });
  });

  router.get('/:slug/revisions', async (req, res) => {
    const { slug } = parseParams(slugParams, req);
    const page = await db('wikiPages').where({ slug }).first('id');
    if (!page) throw notFound('Page');
    res.json({
      items: await db('wikiRevisions as r')
        .leftJoin('users as u', 'u.id', 'r.editedBy')
        .where('r.pageId', page.id)
        .orderBy('r.revision', 'desc')
        .select('r.revision', 'r.title', 'r.bodyMd', 'r.editedAt', 'u.fullName as editedByName'),
    });
  });

  /** Brings an old version back as a new version (nothing is lost). */
  router.post('/:slug/restore/:revision', async (req, res) => {
    const { slug, revision } = parseParams(z.object({ slug: slugSchema, revision: z.coerce.number().int().min(1) }), req);
    const item = await db.transaction(async (trx) => {
      const page = await trx('wikiPages').where({ slug }).forUpdate().first();
      if (!page) throw notFound('Page');
      const old = await trx('wikiRevisions').where({ pageId: page.id, revision }).first();
      if (!old) throw notFound('Version');
      await saveRevision(trx, page, { title: old.title, category: page.category, bodyMd: old.bodyMd }, req.user?.id);
      await logActivity(trx, { userId: req.user?.id, entityType: 'wiki', entityId: page.id, action: 'restored', summary: `${old.title}: version ${revision} restored` });
      return getPage(trx, slug);
    });
    res.json({ item });
  });

  return router;
}
