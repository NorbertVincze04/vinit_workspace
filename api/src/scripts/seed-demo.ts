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
import { addDays, today } from '../lib/dates.js';
import { changeSubscription, createSubscription, generatePayments, markPaid } from '../modules/billing/billing.service.js';
import { convertLead, moveLead, nextPosition } from '../modules/leads/leads.service.js';
import { createSalon } from '../modules/salons/salons.service.js';

const { values } = parseArgs({ options: { db: { type: 'string', default: 'vinit_demo' }, force: { type: 'boolean', default: false } } });
const target = values.db!;

const DEMO_TABLES = [
  'fin_transactions', 'fin_recurring', 'fin_budgets', 'fin_holdings', 'fin_accounts', 'mkt_posts', 'roadmap_progress',
  'time_entries', 'tickets', 'onboarding_steps', 'onboardings', 'payments', 'subscription_changes', 'subscriptions',
  'lead_activities', 'leads', 'salon_domains', 'salon_status_history', 'salons', 'clients', 'activity_log',
];

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

/**
 * Salon platform demo (fake names and addresses): salons in every state, leads in every stage,
 * Early Bird and beta subscriptions, payments, an onboarding on the 48h clock and tickets.
 * Built with the same service functions the API uses, so every rule applies.
 */
async function seedSalons(db: ReturnType<typeof createKnex>): Promise<void> {
  const now = today();
  const hoursAgo = (h: number): string => new Date(Date.now() - h * 3_600_000).toISOString();
  const client = (name: string, city: string) => ({ name: `${name} SRL`, kind: 'company' as const, city, businessAddress: `Str. Exemplu 1, ${city}` });

  await db.transaction(async (trx) => {
    const id = async (table: string, code: string): Promise<string> => (await trx(table).where({ code }).first('id')).id;
    const [standard, premium, custom] = [await id('plans', 'standard'), await id('plans', 'premium'), await id('plans', 'custom')];
    const [earlyBird, beta] = [await id('promotions', 'early_bird'), await id('promotions', 'beta')];

    // 1. Early Bird salon that became paying: trial over, last month paid, this month due.
    const lab = await createSalon(trx, {
      name: 'Barber Lab (demo)',
      city: 'Cluj-Napoca',
      planId: premium,
      status: 'trial',
      domain: 'barberlab-demo.ro',
      tenantSlug: 'barber-lab-demo',
      client: client('Barber Lab', 'Cluj-Napoca'),
    });
    const labSub = await createSubscription(trx, lab, { planId: premium, promotionId: earlyBird, startedOn: addDays(now, -130) });
    await changeSubscription(trx, labSub, { kind: 'trial_converted', on: addDays(now, -38) });
    await generatePayments(trx, addDays(now, -31).slice(0, 7));
    await generatePayments(trx, now.slice(0, 7));
    const first = await trx('payments').where({ salonId: lab }).orderBy('dueOn').first('id');
    if (first) await markPaid(trx, first.id, { paidOn: addDays(now, -25), invoiceNumber: 'DEMO-001' });
    await trx('salons').where({ id: lab }).update({ deployStatus: 'live', goLiveOn: addDays(now, -125), configVersion: 'v4' });

    // 2. New Early Bird salon in onboarding: materials arrived 20h ago, 7 steps done.
    const central = await createSalon(trx, { name: 'Frizeria Centrală (demo)', city: 'Satu Mare', planId: standard, status: 'trial', client: client('Frizeria Centrala', 'Satu Mare') });
    await createSubscription(trx, central, { planId: standard, promotionId: earlyBird, startedOn: addDays(now, -2) });
    const [ob] = await trx('onboardings').insert({ salonId: central, signedAt: hoursAgo(50), materialsReceivedAt: hoursAgo(20) }).returning('id');
    const template = await trx('onboardingTemplateItems').orderBy('position');
    await trx('onboardingSteps').insert(
      template.map((t: Record<string, unknown>, i: number) => ({
        onboardingId: ob.id,
        position: i,
        title: t['title'],
        description: t['description'],
        category: t['category'],
        doneAt: i < 7 ? hoursAgo(18 - i) : null,
      })),
    );
    await trx('timeEntries').insert({ salonId: central, onboardingId: ob.id, kind: 'included_session', minutes: 30, workedOn: now, description: 'Kickoff session' });

    // 3. Beta salon (free, doesn't use Early Bird places).
    const aurora = await createSalon(trx, { name: 'Salon Aurora (demo)', city: 'Pitești', planId: standard, status: 'trial', client: client('Aurora Beauty', 'Pitești') });
    await createSubscription(trx, aurora, { planId: standard, promotionId: beta, startedOn: addDays(now, -60) });

    // 4. Custom subscription with an urgent ticket and unbilled extra work.
    const noir = await createSalon(trx, { name: 'Studio Noir (demo)', city: 'Iași', planId: custom, status: 'active', domain: 'studionoir-demo.ro', client: client('Studio Noir', 'Iași') });
    await createSubscription(trx, noir, { planId: custom, priceBani: RON(1200), startedOn: addDays(now, -70) });
    const [ticket] = await trx('tickets').insert({ salonId: noir, title: 'SMS reminders arrive one hour late', type: 'bug', priority: 'urgent', status: 'in_progress' }).returning('id');
    await trx('timeEntries').insert([
      { salonId: noir, ticketId: ticket.id, kind: 'internal', minutes: 40, workedOn: now, description: 'Looked at the Twilio logs' },
      { salonId: noir, kind: 'billable', rateBani: 10000, minutes: 75, workedOn: addDays(now, -3), description: 'New gallery page' },
      { salonId: noir, kind: 'included_session', minutes: 30, workedOn: addDays(now, -65), description: 'Kickoff' },
    ]);

    // 5. A salon that left.
    const old = await createSalon(trx, { name: 'Old School Barbers (demo)', city: 'Constanța', planId: standard, status: 'active', client: client('Old School', 'Constanta') });
    const oldSub = await createSubscription(trx, old, { planId: standard, startedOn: addDays(now, -200) });
    await changeSubscription(trx, oldSub, { kind: 'cancel', on: addDays(now, -30), note: 'Moved to a marketplace app' });

    // Leads in every stage.
    const leads: [string, string, string, Record<string, unknown>][] = [
      ['Barber House (demo)', 'Buzău', 'contacted', { source: 'instagram_dm', nextFollowUpOn: now }],
      ['Gentlemen Cuts (demo)', 'Timișoara', 'contacted', { source: 'visit', nextFollowUpOn: addDays(now, -2) }],
      ['Fade Factory (demo)', 'Cluj-Napoca', 'replied', { source: 'instagram_dm', nextFollowUpOn: addDays(now, 3), employees: 4 }],
      ['Classic Barber (demo)', 'Iași', 'demo_booked', { source: 'referral', referredBySalonId: lab, demoAt: new Date(Date.now() + 2 * 86_400_000).toISOString() }],
      ['Beard & Co (demo)', 'Eforie Nord', 'contacted', { source: 'email' }],
    ];
    for (const [businessName, city, stage, extra] of leads) {
      await trx('leads').insert({ businessName, city, stage, stagePosition: await nextPosition(trx, stage), ...extra });
    }
    const [lost] = await trx('leads').insert({ businessName: 'Salon Elegance (demo)', city: 'Constanța', stagePosition: await nextPosition(trx, 'contacted') }).returning('id');
    await moveLead(trx, lost.id, { stage: 'lost', lostReason: 'price', lostNote: 'Pays 99 RON elsewhere' });

    // A lead won and converted: the salon page shows where it came from.
    const [won] = await trx('leads')
      .insert({ businessName: 'Urban Barber (demo)', city: 'Cluj-Napoca', stage: 'demo_booked', source: 'instagram_dm', stagePosition: await nextPosition(trx, 'demo_booked') })
      .returning('id');
    await trx('leadActivities').insert({ leadId: won.id, kind: 'dm', body: 'Sent the demo link, they liked having their own brand', occurredAt: hoursAgo(24 * 6) });
    await convertLead(trx, won.id, { client: client('Urban Barber', 'Cluj-Napoca'), salon: { status: 'trial', planId: standard } });
  });
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

    await seedSalons(db);

    console.log(`Demo data is in "${target}". Start the API with DB_NAME=${target} to look at it.`);
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
