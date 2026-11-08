import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/knex.js';
import { HttpError, notFound } from '../../http/errors.js';
import { parseBody, parseParams } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { monthOf, today } from '../../lib/dates.js';
import { planStart, yearOfMonth, yearRange } from '../../lib/targets.js';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const line = (max = 300) => z.string().trim().max(max);
const para = (max = 2000) => z.string().max(max);

/** A year's marketing strategy: who we talk to, what we say, through which channels, month by month. */
export const strategySchema = z
  .object({
    objectives: z.array(line(500)).max(20),
    audience: z.object({ geographic: para(), demographic: para(), behavioral: para(), psychographic: para() }).strict(),
    persona: z.object({ name: line(), age: line(40), role: line(), lifestyle: para(), problem: para() }).strict(),
    positioning: z
      .object({
        valueProposition: para(),
        slogan: line(),
        feature: para(),
        advantage: para(),
        benefit: para(),
        pricing: para(),
        distribution: para(),
        competitors: para(),
        launchOffer: para(),
      })
      .strict(),
    /** One-off launch marketing budget in RON. */
    launchBudget: z.number().int().min(0).max(10_000_000),
    channels: z
      .array(
        z
          .object({
            key: z.string().regex(/^[a-z0-9_-]{1,40}$/),
            label: line(80).min(1),
            target: z.number().int().min(0).max(100),
            tactics: para(),
          })
          .strict(),
      )
      .min(1)
      .max(12)
      .refine((list) => new Set(list.map((c) => c.key)).size === list.length, 'Channel keys must be unique.'),
    months: z
      .array(
        z
          .object({
            element: line(),
            theme: line(),
            goal: para(),
            keywords: z.array(line(80)).max(20),
            target: z.number().int().min(0).max(10_000),
            where: line(),
            /** Ad budget for the month in RON. */
            budget: z.number().int().min(0).max(10_000_000),
          })
          .strict(),
      )
      .length(12),
  })
  .strict();

const yearParams = z.object({ year: z.coerce.number().int().min(1).max(50) });
const strategyBody = z.object({ strategy: strategySchema }).strict();

export interface MarketingYear {
  year: number;
  /** First and last calendar month, "YYYY-MM". */
  from: string;
  to: string;
  status: 'past' | 'current' | 'future';
  /** null = never saved (Year 1 shows the business plan's). */
  strategy: unknown;
  /** Content items planned in the year. */
  posts: number;
}

/** Year 1 always, plus every year added. */
async function marketingYears(k: typeof db): Promise<{ currentYear: number; items: MarketingYear[] }> {
  const [start, rows, counts] = await Promise.all([
    planStart(k),
    k('marketingYears').orderBy('year').select('year', 'strategy'),
    k('mktPosts').groupBy('year').select('year', k.raw('count(*)::int as n')),
  ]);
  const now = monthOf(today());
  const currentYear = yearOfMonth(start, now);
  const last = Math.max(1, ...rows.map((r: Row) => r.year));
  const items: MarketingYear[] = [];
  for (let year = 1; year <= last; year++) {
    const row = rows.find((r: Row) => r.year === year);
    if (!row && year !== 1) continue;
    const range = yearRange(start, year);
    items.push({
      year,
      ...range,
      // Before the plan starts, Year 1 is the current one (as in the roadmap).
      status: range.to < now ? 'past' : year === currentYear ? 'current' : 'future',
      strategy: row?.strategy ?? null,
      posts: counts.find((c: Row) => c.year === year)?.n ?? 0,
    });
  }
  return { currentYear, items };
}

/**
 * Marketing by plan year.
 *   GET    /marketing/years           every year (Year 1 always) with its strategy and content count
 *   POST   /marketing/years           adds the next year with the given strategy (the app sends a copy of the last)
 *   PUT    /marketing/years/:year     saves a year's strategy
 *   DELETE /marketing/years/:year     only the last year, not Year 1, not started and without content
 * Content items stay /marketing/posts, each with its year.
 */
export function marketingRouter(): Router {
  const router = Router();

  router.get('/years', async (_req, res) => {
    res.json(await marketingYears(db));
  });

  router.post('/years', async (req, res) => {
    const { strategy } = parseBody(strategyBody, req);
    const year = await db.transaction(async (trx) => {
      const [{ last }] = await trx('marketingYears').max('year as last');
      const next = Math.max(1, Number(last) || 1) + 1;
      if (next > 50) throw new HttpError(409, 'too_many', 'That is enough years.');
      await trx('marketingYears').insert({ year: next, strategy: JSON.stringify(strategy), updatedBy: req.user?.id ?? null });
      await logActivity(trx, { userId: req.user?.id, entityType: 'marketing/years', entityId: String(next), action: 'created', summary: `Year ${next} marketing plan` });
      return next;
    });
    const all = await marketingYears(db);
    res.status(201).json({ item: all.items.find((y) => y.year === year) });
  });

  router.put('/years/:year', async (req, res) => {
    const { year } = parseParams(yearParams, req);
    const { strategy } = parseBody(strategyBody, req);
    await db.transaction(async (trx) => {
      const exists = await trx('marketingYears').where({ year }).first();
      if (!exists && year !== 1) throw notFound('Year');
      await trx('marketingYears')
        .insert({ year, strategy: JSON.stringify(strategy), updatedBy: req.user?.id ?? null })
        .onConflict('year')
        .merge(['strategy', 'updatedBy']);
      await logActivity(trx, { userId: req.user?.id, entityType: 'marketing/years', entityId: String(year), action: 'updated', summary: `Year ${year} marketing strategy` });
    });
    const all = await marketingYears(db);
    res.json({ item: all.items.find((y) => y.year === year) });
  });

  router.delete('/years/:year', async (req, res) => {
    const { year } = parseParams(yearParams, req);
    await db.transaction(async (trx) => {
      if (year === 1) throw new HttpError(409, 'first_year', 'Year 1 stays.');
      const [{ last }] = await trx('marketingYears').max('year as last');
      if (Number(last) !== year) throw new HttpError(409, 'not_last', 'Only the last year can be removed.');
      if (yearRange(await planStart(trx), year).from <= monthOf(today())) throw new HttpError(409, 'started', 'This year has started: change its strategy instead.');
      const [{ n }] = await trx('mktPosts').where({ year }).count({ n: '*' });
      if (Number(n) > 0) throw new HttpError(409, 'has_content', `Year ${year} has ${n} content item${Number(n) === 1 ? '' : 's'}: delete or move them first.`);
      await trx('marketingYears').where({ year }).delete();
      await logActivity(trx, { userId: req.user?.id, entityType: 'marketing/years', entityId: String(year), action: 'deleted', summary: `Year ${year} marketing plan` });
    });
    res.status(204).end();
  });

  return router;
}
