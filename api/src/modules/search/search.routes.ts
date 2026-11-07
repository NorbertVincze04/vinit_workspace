import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { parseQuery } from '../../http/validate.js';
import { prefixQuery } from '../wiki/wiki.routes.js';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface SearchHit {
  type: 'salon' | 'lead' | 'ticket' | 'contract' | 'feature' | 'wiki';
  id: string;
  title: string;
  sub: string;
  link: string;
}

const PER_TYPE = 6;

/** "Ștefan  cel mare" → ["stefan", "cel", "mare"] (lower case, no diacritics). */
export function words(q: string): string[] {
  return q
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[%_\\]/g, ''))
    .filter(Boolean)
    .slice(0, 6);
}

/** Every word must appear somewhere in the fields (diacritics ignored); best title matches first. */
function match(q: Knex.QueryBuilder, fields: string, title: string, ws: string[], phrase: string): Knex.QueryBuilder {
  for (const w of ws) q.whereRaw(`unaccent(lower(concat_ws(' ', ${fields}))) LIKE ?`, [`%${w}%`]);
  return q.orderByRaw(`similarity(unaccent(lower(${title})), ?) DESC`, [phrase]).limit(PER_TYPE);
}

/** /search?q= — one box for salons (with who pays for them), leads, tickets, contracts, feature requests and wiki pages. */
export function searchRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { q } = parseQuery(z.object({ q: z.string().max(200).default('') }), req);
    const ws = words(q);
    if (!ws.length) {
      res.json({ items: [] });
      return;
    }
    const phrase = ws.join(' ');
    // "T-12", "t12", "#12" → ticket 12
    const ticketNo = /^(?:t-?|#)?(\d{1,6})$/i.exec(q.trim())?.[1];
    const tsq = prefixQuery(q);

    const [salons, leads, tickets, contracts, features, wiki] = await Promise.all([
      match(
        db('salons as s').join('clients as c', 'c.id', 's.clientId').leftJoin('salonDomains as d', function () {
          this.on('d.salonId', '=', 's.id').andOnVal('d.isPrimary', '=', true);
        }).select('s.id', 's.name', 's.city', 's.status', 'd.domain', 'c.name as clientName'),
        's.name, s.city, s.tenant_slug, d.domain, c.name, c.contact_person, c.email, c.phone',
        's.name',
        ws,
        phrase,
      ),
      match(db('leads as l').select('l.id', 'l.businessName', 'l.city', 'l.stage', 'l.phone'), 'l.business_name, l.contact_name, l.city, l.phone, l.email, l.instagram', 'l.business_name', ws, phrase),
      ticketNo
        ? db('tickets as t').join('salons as s', 's.id', 't.salonId').where('t.number', Number(ticketNo)).select('t.id', 't.number', 't.title', 't.status', 't.salonId', 's.name as salonName').limit(1)
        : match(db('tickets as t').join('salons as s', 's.id', 't.salonId').select('t.id', 't.number', 't.title', 't.status', 't.salonId', 's.name as salonName'), 't.title, t.description, s.name', 't.title', ws, phrase),
      match(db('contracts as ct').join('salons as s', 's.id', 'ct.salonId').select('ct.id', 'ct.number', 'ct.kind', 'ct.status', 'ct.salonId', 's.name as salonName'), "ct.number, replace(ct.kind, '_', ' '), s.name", 'ct.number', ws, phrase),
      match(db('featureRequests as f').select('f.id', 'f.title', 'f.status'), 'f.title, f.description', 'f.title', ws, phrase),
      tsq
        ? db('wikiPages as p')
            .where('p.archived', false)
            .whereRaw(`p.search @@ to_tsquery('simple', ?)`, [tsq])
            .orderByRaw(`ts_rank(p.search, to_tsquery('simple', ?)) DESC`, [tsq])
            .limit(PER_TYPE)
            .select('p.slug', 'p.title', 'p.category')
        : Promise.resolve([]),
    ]);

    const items: SearchHit[] = [
      ...salons.map((s: Row) => ({ type: 'salon' as const, id: s.id, title: s.name, sub: [s.city, s.domain, s.clientName !== s.name ? s.clientName : null, s.status].filter(Boolean).join(' · '), link: `/tools/salons/${s.id}` })),
      ...leads.map((l: Row) => ({ type: 'lead' as const, id: l.id, title: l.businessName, sub: [l.city, l.stage.replace('_', ' '), l.phone].filter(Boolean).join(' · '), link: '/tools/leads' })),
      ...tickets.map((t: Row) => ({
        type: 'ticket' as const,
        id: t.id,
        title: `T-${String(t.number).padStart(4, '0')} ${t.title}`,
        sub: `${t.salonName} · ${t.status.replace('_', ' ')}`,
        link: `/tools/salons/${t.salonId}?tab=support`,
      })),
      ...contracts.map((c: Row) => ({
        type: 'contract' as const,
        id: c.id,
        title: `${c.number || 'Contract'} · ${c.kind.replace('_', ' ')}`,
        sub: `${c.salonName} · ${c.status}`,
        link: `/tools/salons/${c.salonId}?tab=contracts`,
      })),
      ...features.map((f: Row) => ({ type: 'feature' as const, id: f.id, title: f.title, sub: `Feature request · ${f.status.replace('_', ' ')}`, link: '/tools/features' })),
      ...(wiki as Row[]).map((p) => ({ type: 'wiki' as const, id: p.slug, title: p.title, sub: `Wiki · ${p.category.replace('_', ' ')}`, link: `/tools/wiki/${p.slug}` })),
    ];
    res.json({ items });
  });

  return router;
}
