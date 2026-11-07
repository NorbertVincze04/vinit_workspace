/**
 * Fills a database with realistic demo data, to try the workspace without touching real data.
 *
 *   npm run db:seed:demo                     → into the database "vinit_demo" (created if missing)
 *   npm run db:seed:demo -- --db other_name  → another database
 *   npm run db:seed:demo -- --force          → wipe the demo tables first if they already have data
 *
 * It refuses to run against the main "vinit" database. The numbers come from the business plan
 * (costs, prices, marketing calendar); no real people or salons are used.
 * Tasks are not seeded here: the app adds the Year-1 worksheet itself on first open.
 */
import { parseArgs } from 'node:util';
import { config } from '../config.js';
import { createKnex } from '../db/knex.js';
import { migrationConfig } from '../db/migrations/index.js';

const { values } = parseArgs({ options: { db: { type: 'string', default: 'vinit_demo' }, force: { type: 'boolean', default: false } } });
const target = values.db!;

const DEMO_TABLES = ['fin_transactions', 'fin_recurring', 'fin_budgets', 'fin_holdings', 'fin_accounts', 'mkt_posts', 'roadmap_progress'];

/** "YYYY-MM-DD" for the given day of the month `offset` months from now. */
function day(offset: number, dayOfMonth: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offset);
  d.setUTCDate(Math.min(dayOfMonth, 28));
  return d.toISOString().slice(0, 10);
}

const RON = (lei: number): number => Math.round(lei * 100);

// Monthly costs from the business plan (section 5.1), as recurring business expenses.
const RECURRING: [string, number, string, number][] = [
  ['Vercel', 100, 'Subscriptions & software', 3],
  ['Railway', 100, 'Subscriptions & software', 3],
  ['Twilio SMS (≈1.500 SMS)', 300, 'Subscriptions & software', 5],
  ['GitHub Copilot', 200, 'Subscriptions & software', 8],
  ['Figma', 80, 'Subscriptions & software', 10],
  ['Microsoft 365', 40, 'Subscriptions & software', 10],
  ['Adobe Creative Cloud Pro', 460, 'Subscriptions & software', 12],
  ['Accounting', 500, 'Accounting & legal', 20],
  ['Lawyer (retainer)', 500, 'Accounting & legal', 20],
  ['Meta Ads', 500, 'Advertising', 1],
  ['Internet', 100, 'Phone & internet', 15],
  ['Phone plan', 50, 'Phone & internet', 15],
];

// Marketing calendar, business plan annex 3 (month, mix, theme, appearances, platforms).
const POSTS: [number, string, string, number, string[]][] = [
  [1, 'advertising', 'Launch: marketplace vs. your own brand', 8, ['Instagram']],
  [2, 'sales', 'Early Bird: free demo + 3 months free', 15, ['Instagram', 'WhatsApp']],
  [3, 'advertising', 'Automatic waitlist and SMS reminders', 4, ['Instagram', 'Facebook']],
  [4, 'pr', 'Testimonials from the first salons', 4, ['Instagram', 'TikTok']],
  [5, 'direct', 'The real cost of a marketplace per chair', 6, ['LinkedIn', 'Instagram']],
  [6, 'sales', 'Premium Brand summer upgrade', 4, ['Facebook', 'Email']],
  [7, 'pr', 'Sponsoring a local barbering course', 2, ['Instagram']],
  [8, 'advertising', 'UX focus: how easy booking is', 5, ['TikTok', 'Instagram']],
  [9, 'direct', 'Outreach to 3+ chair salons outside Cluj', 20, ['Email', 'LinkedIn']],
  [10, 'sales', 'Referral: bring a salon, get 3 months free', 4, ['Email']],
  [11, 'pr', 'Year in review: hours saved by automation', 6, ['Instagram', 'Facebook']],
  [12, 'advertising', 'Holidays: the gift your salon wants is independence', 8, ['Instagram', 'Facebook', 'TikTok']],
];

async function ensureDatabase(): Promise<void> {
  const admin = createKnex({ connection: { ...config.db, database: 'postgres' } });
  try {
    const exists = await admin.raw('SELECT 1 FROM pg_database WHERE datname = ?', [target]);
    if (!(exists as { rows: unknown[] }).rows.length) {
      await admin.raw(`CREATE DATABASE "${target}"`);
      console.log(`Created database ${target}.`);
    }
  } finally {
    await admin.destroy();
  }
}

async function main(): Promise<void> {
  if (target === 'vinit') throw new Error('Refusing to put demo data into the main "vinit" database. Use --db vinit_demo.');
  if (!/^[a-z0-9_]{1,40}$/.test(target)) throw new Error('Database names may only use a-z, 0-9 and _.');
  await ensureDatabase();

  const db = createKnex({ connection: { ...config.db, database: target } });
  try {
    await db.migrate.latest(migrationConfig);
    const counts = await Promise.all(DEMO_TABLES.map(async (t) => Number((await db(t).count({ n: '*' }).first())?.n ?? 0)));
    if (counts.some((n) => n > 0)) {
      if (!values.force) throw new Error(`${target} already has data. Run again with --force to replace the demo tables.`);
      await db.raw(`TRUNCATE ${DEMO_TABLES.join(', ')} CASCADE`);
    }

    await db.transaction(async (trx) => {
      await trx('fin_accounts').insert([
        { id: 'demo-bt', name: 'Banca Transilvania – VINIT SRL', kind: 'bank', balanceBani: RON(18_450), asOf: day(0, 1) },
        { id: 'demo-revolut', name: 'Revolut (personal)', kind: 'bank', balanceBani: RON(3_210.4), asOf: day(0, 1) },
        { id: 'demo-cash', name: 'Cash', kind: 'cash', balanceBani: RON(350) },
      ]);
      await trx('fin_holdings').insert({
        id: 'demo-etf', name: 'Global ETF', kind: 'ETF & stocks', platform: 'Broker', openingBani: RON(5_000),
        currentValueBani: RON(5_620), currency: 'RON', valueDate: day(0, 1),
      });

      const recurring = RECURRING.map(([name, lei, category, dom], i) => ({
        id: `demo-rc${i + 1}`, type: 'expense', name, amountBani: RON(lei), category, scope: 'business',
        frequency: 'monthly', nextDate: day(0, dom), accountId: 'demo-bt', active: true,
      }));
      recurring.push({
        id: 'demo-rc-domain', type: 'expense', name: 'Domain vinit.ro', amountBani: RON(100), category: 'Subscriptions & software',
        scope: 'business', frequency: 'yearly', nextDate: day(4, 1), accountId: 'demo-bt', active: true,
      });
      await trx('fin_recurring').insert(recurring);

      // The last two months of those costs as real transactions, plus a grant and the first beta revenue.
      const tx: Record<string, unknown>[] = [];
      for (const offset of [-2, -1]) {
        RECURRING.forEach(([name, lei, category, dom], i) =>
          tx.push({ type: 'expense', description: name, amountBani: RON(lei), category, scope: 'business',
            date: day(offset, dom), accountId: 'demo-bt', recurringId: `demo-rc${i + 1}` }),
        );
      }
      tx.push(
        { type: 'income', description: 'Share capital', amountBani: RON(1_000), category: 'Other income', scope: 'business', date: day(-2, 2), accountId: 'demo-bt' },
        { type: 'income', description: 'Demo: Custom website project (advance)', amountBani: RON(1_000), category: 'VINIT revenue', scope: 'business', date: day(-1, 18), accountId: 'demo-bt' },
        { type: 'expense', description: 'Laptop', amountBani: RON(6_600), category: 'Business costs', scope: 'business', date: day(-2, 5), accountId: 'demo-bt' },
        { type: 'expense', description: 'PLA filament (biodegradable)', amountBani: RON(189.9), category: 'Business costs', scope: 'business', date: day(-1, 9), accountId: 'demo-bt' },
        { type: 'invest', description: 'ETF monthly', amountBani: RON(500), category: 'ETF & stocks', scope: 'personal', date: day(-1, 25), accountId: 'demo-revolut', holdingId: 'demo-etf' },
      );
      await trx('fin_transactions').insert(tx);

      await trx('fin_budgets').insert([
        { category: 'Advertising', limitBani: RON(500) },
        { category: 'Subscriptions & software', limitBani: RON(1_280) },
        { category: 'Accounting & legal', limitBani: RON(1_000) },
      ]);

      await trx('mkt_posts').insert(
        POSTS.map(([month, mix, title, count, platforms]) => ({
          title, month, mix, count, platforms, format: 'post', week: 0,
          status: month <= 1 ? 'published' : month === 2 ? 'ready' : 'planned',
          budgetBani: mix === 'advertising' ? RON(500) : 0,
          hashtags: '#barbershop #frizerie #cluj #vinit',
        })),
      );

      await trx('roadmap_progress').insert(['b1', 'b2', 'b3', 'b4'].map((stepId) => ({ stepId })));
    });

    console.log(`Demo data is in "${target}". Start the API with DB_NAME=${target} to look at it.`);
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
