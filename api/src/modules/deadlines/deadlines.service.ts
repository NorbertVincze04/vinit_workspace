import type { Knex } from 'knex';
import { addMonths } from '../../lib/dates.js';

type Db = Knex | Knex.Transaction;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface GeneratedDeadline {
  title: string;
  category: string;
  dueOn: string;
  salonId: string | null;
  sourceType: string;
  sourceId: string;
  url?: string;
}

type Generator = (k: Db) => Promise<GeneratedDeadline[]>;

/** Where generated deadlines come from. Other modules (infra) add theirs with addGenerator(). */
const GENERATORS: Generator[] = [
  async (k) =>
    (await k('salonDomains as d').join('salons as s', 's.id', 'd.salonId').whereNot('s.status', 'churned').whereNotNull('d.expiresOn').select('d.*', 's.name as salonName')).map((d: Row) => ({
      title: `Domain ${d.domain} expires${d.autoRenew ? ' (auto-renew: check the card)' : ''}`,
      category: 'domain_renewal',
      dueOn: d.expiresOn,
      salonId: d.salonId,
      sourceType: 'domain',
      sourceId: d.id,
    })),
  async (k) =>
    (await k('salonDomains as d').join('salons as s', 's.id', 'd.salonId').whereNot('s.status', 'churned').whereNotNull('d.sslExpiresOn').select('d.*')).map((d: Row) => ({
      title: `SSL certificate of ${d.domain} expires`,
      category: 'domain_renewal',
      dueOn: d.sslExpiresOn,
      salonId: d.salonId,
      sourceType: 'ssl',
      sourceId: d.id,
    })),
  async (k) =>
    (await k('contracts as c').join('salons as s', 's.id', 'c.salonId').where('c.status', 'signed').whereNotNull('c.renewalOn').select('c.*', 's.name as salonName')).map((c: Row) => ({
      title: `${c.salonName}: contract ${c.number} renewal${c.autoRenew ? ' (renews automatically)' : ''}`,
      category: 'contract_renewal',
      dueOn: c.renewalOn,
      salonId: c.salonId,
      sourceType: 'contract',
      sourceId: c.id,
    })),
  async (k) =>
    (await k('subscriptions as x').join('salons as s', 's.id', 'x.salonId').where('x.status', 'trialing').whereNotNull('x.trialEndsOn').select('x.*', 's.name as salonName')).map((x: Row) => ({
      title: `${x.salonName}: free months end (convert to paid)`,
      category: 'trial_end',
      dueOn: x.trialEndsOn,
      salonId: x.salonId,
      sourceType: 'trial',
      sourceId: x.id,
    })),
  async (k) =>
    (await k('subscriptions as x')
      .join('salons as s', 's.id', 'x.salonId')
      .whereIn('x.status', ['active', 'past_due', 'paused'])
      .whereNotNull('x.minTermEndsOn')
      .select('x.*', 's.name as salonName')).map((x: Row) => ({
      title: `${x.salonName}: minimum term ends (talk about renewal)`,
      category: 'contract_renewal',
      dueOn: x.minTermEndsOn,
      salonId: x.salonId,
      sourceType: 'min_term',
      sourceId: x.id,
    })),
];

export function addGenerator(generator: Generator): void {
  GENERATORS.push(generator);
}

/**
 * Brings generated deadlines in line with the data: adds new ones, updates titles, and removes open
 * ones whose source changed or disappeared (done/dismissed ones stay as history). Idempotent.
 */
export async function regenerateDeadlines(k: Db): Promise<{ added: number; removed: number }> {
  const wanted: GeneratedDeadline[] = [];
  for (const g of GENERATORS) wanted.push(...(await g(k)));
  const key = (d: { sourceType: string; sourceId: string; dueOn: string }) => `${d.sourceType}|${d.sourceId}|${d.dueOn}`;
  const wantedKeys = new Set(wanted.map(key));

  const existing: Row[] = await k('deadlines').whereNotNull('sourceType').select('id', 'sourceType', 'sourceId', 'dueOn', 'title', 'status');
  const byKey = new Map(existing.map((d) => [key(d as never), d]));

  let added = 0;
  for (const w of wanted) {
    const have = byKey.get(key(w));
    if (!have) {
      await k('deadlines').insert({ ...w, url: w.url ?? '' }).onConflict(k.raw('(source_type, source_id, due_on) WHERE source_type IS NOT NULL')).ignore();
      added++;
    } else if (have.title !== w.title) {
      await k('deadlines').where({ id: have.id }).update({ title: w.title });
    }
  }
  const stale = existing.filter((d) => d.status === 'open' && !wantedKeys.has(key(d as never))).map((d) => d.id);
  if (stale.length) await k('deadlines').whereIn('id', stale).delete();
  return { added, removed: stale.length };
}

const STEP: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };

/** Next date of a repeating deadline. */
export const nextOccurrence = (dueOn: string, recurrence: string): string | null => (STEP[recurrence] ? addMonths(dueOn, STEP[recurrence]) : null);

