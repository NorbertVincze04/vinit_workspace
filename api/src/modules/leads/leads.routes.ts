import { Router } from 'express';
import { db } from '../../db/knex.js';
import { notFound } from '../../http/errors.js';
import { parseBody, parseParams, parseQuery } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { uuidParams } from '../../lib/schemas.js';
import { addOverviewPart } from '../salons/salons.routes.js';
import { getSalonRow, todayBucharest } from '../salons/salons.service.js';
import { activityCreate, leadConvert, leadCreate, leadImport, leadListQuery, leadMove, leadPatch } from './leads.schemas.js';
import { convertLead, getLeadRow, leadRows, moveLead, nextPosition } from './leads.service.js';

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Normalised key used to skip duplicates on import: name + phone digits. */
const dupKey = (name: unknown, phone: unknown): string =>
  `${String(name ?? '').trim().toLowerCase()}|${String(phone ?? '').replace(/\D/g, '').slice(-9)}`;

/** The salon page shows the lead it came from, with every contact before signing. */
addOverviewPart('lead', async (k, salon) => {
  if (!salon['leadId']) return null;
  const lead = await leadRows(k).where('l.id', salon['leadId']).first();
  if (!lead) return null;
  const activities = await k('leadActivities as a')
    .leftJoin('users as u', 'u.id', 'a.userId')
    .where('a.leadId', lead.id)
    .orderBy('a.occurredAt', 'desc')
    .select('a.*', 'u.fullName as userName');
  return { ...lead, activities };
});

/** /leads — the sales pipeline (kanban + list), activities and conversion into a salon. */
export function leadsRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { stage, q, due } = parseQuery(leadListQuery, req);
    const query = leadRows(db).orderBy([{ column: 'l.stage' }, { column: 'l.stagePosition' }, { column: 'l.createdAt' }]);
    if (stage) query.where('l.stage', stage);
    if (q?.trim()) {
      query.whereRaw(`unaccent(concat_ws(' ', l.business_name, l.contact_name, l.city, l.phone, l.email, l.instagram)) ILIKE unaccent(?)`, [
        `%${q.trim()}%`,
      ]);
    }
    if (due) {
      const today = todayBucharest();
      query.whereNotIn('l.stage', ['paying', 'lost']).whereNotNull('l.nextFollowUpOn');
      if (due === 'overdue') query.where('l.nextFollowUpOn', '<', today);
      if (due === 'today') query.where('l.nextFollowUpOn', '<=', today);
      if (due === 'week') query.where('l.nextFollowUpOn', '<=', addDays(today, 7));
    }
    res.json({ items: await query });
  });

  router.post('/', async (req, res) => {
    const data = parseBody(leadCreate, req);
    const item = await db.transaction(async (trx) => {
      const stage = data.stage ?? 'contacted';
      const [row] = await trx('leads')
        .insert({ ...data, stage, ownerUserId: data.ownerUserId ?? req.user?.id ?? null, stagePosition: await nextPosition(trx, stage) })
        .returning('*');
      await logActivity(trx, { userId: req.user?.id, entityType: 'leads', entityId: row.id as string, action: 'created', summary: row.businessName as string });
      return getLeadRow(trx, row.id as string);
    });
    res.status(201).json({ item });
  });

  router.post('/import', async (req, res) => {
    const { rows } = parseBody(leadImport, req);
    const result = await db.transaction(async (trx) => {
      const existing = new Set((await trx('leads').select('businessName', 'phone')).map((r) => dupKey(r.businessName, r.phone)));
      const skipped: string[] = [];
      let created = 0;
      for (const row of rows) {
        const key = dupKey(row.businessName, row.phone);
        if (existing.has(key)) {
          skipped.push(row.businessName);
          continue;
        }
        existing.add(key);
        const stage = row.stage ?? 'contacted';
        await trx('leads').insert({ ...row, stage, ownerUserId: row.ownerUserId ?? req.user?.id ?? null, stagePosition: await nextPosition(trx, stage) });
        created++;
      }
      await logActivity(trx, { userId: req.user?.id, entityType: 'leads', action: 'imported', summary: `Imported ${created} leads`, data: { created, skipped: skipped.length } });
      return { created, skipped };
    });
    res.json(result);
  });

  router.get('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const [item, activities] = await Promise.all([
      getLeadRow(db, id),
      db('leadActivities as a')
        .leftJoin('users as u', 'u.id', 'a.userId')
        .where('a.leadId', id)
        .orderBy([{ column: 'a.occurredAt', order: 'desc' }, { column: 'a.createdAt', order: 'desc' }])
        .select('a.*', 'u.fullName as userName'),
    ]);
    res.json({ item, activities });
  });

  router.patch('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const patch = parseBody(leadPatch, req);
    const item = await db.transaction(async (trx) => {
      const [row] = Object.keys(patch).length
        ? await trx('leads').where({ id }).update(patch).returning('*')
        : await trx('leads').where({ id }).select('*');
      if (!row) throw notFound('Lead');
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'leads',
        entityId: id,
        salonId: (row.convertedSalonId as string | null) ?? null,
        action: 'updated',
        summary: row.businessName as string,
        data: { fields: Object.keys(patch) },
      });
      return getLeadRow(trx, id);
    });
    res.json({ item });
  });

  router.delete('/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    await db.transaction(async (trx) => {
      const [row] = await trx('leads').where({ id }).delete().returning('*');
      if (!row) throw notFound('Lead');
      await logActivity(trx, { userId: req.user?.id, entityType: 'leads', entityId: id, action: 'deleted', summary: row.businessName as string });
    });
    res.status(204).end();
  });

  router.post('/:id/move', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const input = parseBody(leadMove, req);
    await db.transaction((trx) => moveLead(trx, id, input, req.user?.id));
    // The whole board, since other cards' positions changed too.
    res.json({ items: await leadRows(db).orderBy([{ column: 'l.stage' }, { column: 'l.stagePosition' }, { column: 'l.createdAt' }]) });
  });

  router.post('/:id/activities', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const data = parseBody(activityCreate, req);
    const item = await db.transaction(async (trx) => {
      const lead = await trx('leads').where({ id }).first('id', 'businessName', 'convertedSalonId');
      if (!lead) throw notFound('Lead');
      const [row] = await trx('leadActivities')
        .insert({ ...data, leadId: id, userId: req.user?.id ?? null })
        .returning('*');
      await logActivity(trx, {
        userId: req.user?.id,
        entityType: 'leads',
        entityId: id,
        salonId: (lead.convertedSalonId as string | null) ?? null,
        action: `contact_${data.kind}`,
        summary: `${lead.businessName}: ${data.body.slice(0, 120)}`,
      });
      return row;
    });
    res.status(201).json({ item });
  });

  router.post('/:id/convert', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const input = parseBody(leadConvert, req);
    const result = await db.transaction(async (trx) => {
      const salonId = await convertLead(trx, id, input, req.user?.id);
      return { lead: await getLeadRow(trx, id), salon: await getSalonRow(trx, salonId) };
    });
    res.status(201).json(result);
  });

  return router;
}
