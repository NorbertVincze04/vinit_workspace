import { Router } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { HttpError, notFound } from '../../http/errors.js';
import { parseBody, parseParams, parseQuery } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { addDays, monthOf, today } from '../../lib/dates.js';
import { currency, id as textId, longText, monthKey, optionalDate, text, timestamp, uuid, uuidParams } from '../../lib/schemas.js';
import { targetsFor } from '../../lib/targets.js';
import { addGenerator } from '../deadlines/deadlines.service.js';

type Db = Knex | Knex.Transaction;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const CATEGORIES = ['hosting', 'database', 'sms', 'domain', 'email', 'tooling', 'other'] as const;
const url = z.union([z.literal(''), z.url('Enter a full link, like https://…').max(500)]);

const serviceFields = z.object({
  name: z.string().trim().min(1, 'Name the service.').max(200),
  vendor: text(200),
  category: z.enum(CATEGORIES),
  planName: text(200),
  monthlyCostBani: z.number().int().min(0).max(100_000_000).nullable(),
  currency,
  recurringId: textId.nullable(),
  renewsOn: optionalDate,
  dashboardUrl: url,
  statusUrl: url,
  passwordManagerRef: text(500),
  active: z.boolean(),
  notes: longText,
});
const serviceCreate = serviceFields.partial().required({ name: true }).extend({ id: uuid.optional() }).strict();
const servicePatch = serviceFields.partial().strict();

const smsBody = z
  .object({
    month: monthKey,
    salonId: uuid.nullable().optional(),
    sent: z.number().int().min(0).max(1_000_000),
    costBani: z.number().int().min(0).max(100_000_000).optional(),
  })
  .strict();
const backupBody = z.object({ kind: z.enum(['backup', 'restore_test']), note: text(1000).optional(), fileName: text(255).optional(), checkedAt: timestamp.optional() }).strict();

const MONTHLY: Record<string, number> = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };

/** EUR/USD → RON with the rates set in Finances (defaults if never set). */
async function rates(k: Db): Promise<{ RON: number; EUR: number; USD: number }> {
  const row = await k('appSettings').where({ key: 'finances.rates' }).first('value');
  const v = (row?.value ?? {}) as { eur?: number; usd?: number };
  return { RON: 1, EUR: Number(v.eur) || 5, USD: Number(v.usd) || 4.6 };
}

/**
 * Services with their monthly cost. Decision G: when linked to a Finances recurring payment, the
 * cost comes from it (normalised to a month); otherwise the service's own estimate is used.
 */
async function serviceRows(k: Db): Promise<Row[]> {
  const r = await rates(k);
  const rows = await k('infraServices as i')
    .leftJoin('finRecurring as fr', 'fr.id', 'i.recurringId')
    .orderBy([{ column: 'i.active', order: 'desc' }, { column: 'i.category' }, { column: 'i.name' }])
    .select('i.*', 'fr.name as recurringName', 'fr.amountBani as recurringAmountBani', 'fr.currency as recurringCurrency', 'fr.frequency as recurringFrequency', 'fr.active as recurringActive');
  return rows.map((s: Row) => {
    const linked = !!s.recurringId && s.recurringAmountBani !== null;
    const monthlyBani = linked ? Math.round(Number(s.recurringAmountBani) * (MONTHLY[s.recurringFrequency] ?? 1)) : Number(s.monthlyCostBani ?? 0);
    const cur: 'RON' | 'EUR' | 'USD' = linked ? s.recurringCurrency : s.currency;
    return {
      ...s,
      costSource: linked ? 'finances' : s.monthlyCostBani === null ? 'none' : 'estimate',
      monthlyBani,
      monthlyCurrency: cur,
      monthlyRonBani: Math.round(monthlyBani * (r[cur] ?? 1)),
    };
  });
}

async function getService(k: Db, id: string): Promise<Row> {
  const row = (await serviceRows(k)).find((s) => s.id === id);
  if (!row) throw notFound('Service');
  return row;
}

const ageDays = (iso: string | null | undefined): number | null => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null);

/** Everything that tells whether the setup is healthy and affordable. */
async function health(k: Db): Promise<Row> {
  const month = monthOf(today());
  const services = (await serviceRows(k)).filter((s) => s.active);
  const monthlyRonBani = services.reduce((sum, s) => sum + s.monthlyRonBani, 0);
  const [sms] = await k('smsUsage').where({ month }).select(k.raw('coalesce(sum(sent), 0)::int as sent'), k.raw('coalesce(sum(cost_bani), 0)::int as cost_bani'));
  const [premium] = await k('subscriptions as x')
    .join('plans as p', 'p.id', 'x.planId')
    .whereIn('x.status', ['active', 'past_due', 'trialing'])
    .where('p.includesSms', true)
    .count({ n: '*' });
  const lastBackup = await k('backupChecks').where({ kind: 'backup' }).orderBy('checkedAt', 'desc').first('checkedAt', 'fileName');
  const lastRestore = await k('backupChecks').where({ kind: 'restore_test' }).orderBy('checkedAt', 'desc').first('checkedAt', 'note');
  const renewing = services
    .filter((s) => s.renewsOn && s.renewsOn >= today() && s.renewsOn <= addDays(today(), 30))
    .map((s) => ({ id: s.id, name: s.name, renewsOn: s.renewsOn }));
  const [size] = (await k.raw('SELECT pg_database_size(current_database())::bigint as db_bytes, (SELECT coalesce(sum(size_bytes), 0)::bigint FROM files) as file_bytes')).rows;
  const premiumSalons = Number(premium.n);
  const goals = await targetsFor(k, month);
  return {
    month,
    costs: { monthlyRonBani, planBani: goals.operationalCostsBani, services: services.length },
    sms: {
      sent: sms.sent,
      costBani: sms.costBani,
      budget: goals.smsMonthlyBudget,
      pct: goals.smsMonthlyBudget ? Math.round((sms.sent / goals.smsMonthlyBudget) * 100) : 0,
      premiumSalons,
      perSalonBudget: premiumSalons ? Math.floor(goals.smsMonthlyBudget / premiumSalons) : null,
    },
    backups: {
      lastBackupAt: lastBackup?.checkedAt ?? null,
      lastBackupDays: ageDays(lastBackup?.checkedAt),
      lastBackupFile: lastBackup?.fileName ?? null,
      lastRestoreTestAt: lastRestore?.checkedAt ?? null,
      lastRestoreTestDays: ageDays(lastRestore?.checkedAt),
    },
    renewing,
    storage: { dbBytes: Number(size.dbBytes), fileBytes: Number(size.fileBytes) },
    api: { uptimeSeconds: Math.round(process.uptime()) },
  };
}

// Service renewals show up in the Calendar.
addGenerator(async (k) =>
  (await k('infraServices').where({ active: true }).whereNotNull('renewsOn').select('id', 'name', 'renewsOn')).map((s: Row) => ({
    title: `${s.name} renews`,
    category: 'service_subscription',
    dueOn: s.renewsOn,
    salonId: null,
    sourceType: 'infra',
    sourceId: s.id,
  })),
);

/** /infra — services and costs, SMS usage, backups, health. */
export function infraRouter(): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    res.json(await health(db));
  });

  router.get('/services', async (_req, res) => {
    res.json({ items: await serviceRows(db) });
  });

  router.post('/services', async (req, res) => {
    const data = parseBody(serviceCreate, req);
    const item = await db.transaction(async (trx) => {
      const [row] = await trx('infraServices').insert(data).returning('*');
      await logActivity(trx, { userId: req.user?.id, entityType: 'infra', entityId: row.id, action: 'created', summary: row.name });
      return getService(trx, row.id);
    });
    res.status(201).json({ item });
  });

  router.patch('/services/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const patch = parseBody(servicePatch, req);
    const item = await db.transaction(async (trx) => {
      const [row] = Object.keys(patch).length ? await trx('infraServices').where({ id }).update(patch).returning('*') : await trx('infraServices').where({ id }).select('*');
      if (!row) throw notFound('Service');
      await logActivity(trx, { userId: req.user?.id, entityType: 'infra', entityId: id, action: 'updated', summary: row.name, data: { fields: Object.keys(patch) } });
      return getService(trx, id);
    });
    res.json({ item });
  });

  router.delete('/services/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    const [row] = await db('infraServices').where({ id }).delete().returning(['id', 'name']);
    if (!row) throw notFound('Service');
    await logActivity(db, { userId: req.user?.id, entityType: 'infra', entityId: id, action: 'deleted', summary: row.name });
    res.status(204).end();
  });

  router.get('/sms-usage', async (req, res) => {
    const { month } = parseQuery(z.object({ month: monthKey.optional() }), req);
    const m = month ?? monthOf(today());
    const items = await db('smsUsage as u').leftJoin('salons as s', 's.id', 'u.salonId').where('u.month', m).orderBy('s.name').select('u.*', 's.name as salonName');
    res.json({ month: m, items, budget: (await targetsFor(db, m)).smsMonthlyBudget });
  });

  /** One number per month and salon (or for the whole account): saving again replaces it. */
  router.put('/sms-usage', async (req, res) => {
    const data = parseBody(smsBody, req);
    const item = await db.transaction(async (trx) => {
      const existing = await trx('smsUsage').where({ month: data.month }).where((q) => (data.salonId ? q.where({ salonId: data.salonId }) : q.whereNull('salonId'))).first('id');
      const values = { sent: data.sent, costBani: data.costBani ?? Math.round(data.sent * 20) };
      const [row] = existing
        ? await trx('smsUsage').where({ id: existing.id }).update(values).returning('*')
        : await trx('smsUsage').insert({ ...values, month: data.month, salonId: data.salonId ?? null }).returning('*');
      return row;
    });
    res.json({ item });
  });

  router.delete('/sms-usage/:id', async (req, res) => {
    const { id } = parseParams(uuidParams, req);
    if (!(await db('smsUsage').where({ id }).delete())) throw notFound('SMS usage');
    res.status(204).end();
  });

  router.get('/backup-checks', async (_req, res) => {
    res.json({
      items: await db('backupChecks as b').leftJoin('users as u', 'u.id', 'b.checkedBy').orderBy('b.checkedAt', 'desc').limit(50).select('b.*', 'u.fullName as checkedByName'),
    });
  });

  router.post('/backup-checks', async (req, res) => {
    const data = parseBody(backupBody, req);
    if (data.checkedAt && new Date(data.checkedAt).getTime() > Date.now() + 60_000) {
      throw new HttpError(400, 'validation', 'That time is in the future.', { checkedAt: 'In the future' });
    }
    const [item] = await db('backupChecks')
      .insert({ kind: data.kind, note: data.note ?? '', fileName: data.fileName ?? '', checkedBy: req.user?.id ?? null, ...(data.checkedAt ? { checkedAt: data.checkedAt } : {}) })
      .returning('*');
    await logActivity(db, { userId: req.user?.id, entityType: 'infra', action: data.kind, summary: data.kind === 'backup' ? 'Backup recorded' : 'Restore test recorded' });
    res.status(201).json({ item });
  });

  return router;
}
