import type { Knex } from 'knex';

/**
 * Corrects the business plan's monthly costs. Its operational line items (ads 500, accounting 500,
 * lawyer 500, software 980, Twilio 300, utilities 300) add up to 3,080 RON, not the 2,600 its text
 * says, so the monthly total is 6,860 RON (+3,780 salaries), not 6,380, and break-even on Standard is
 * 46 salons (46 × 150 = 6,900), not 43.
 *
 * Only rows still holding the old built-in values or texts are changed: anything edited since stays.
 */
const TEXTS: [table: string, column: string, key: string, id: string, from: string, to: string][] = [
  ['goals', 'target', 'id', 'g3', '50 paying salons, MRR >= 7,500 RON; break-even at 43 Standard salons by month 12', '50 paying salons, MRR >= 7,500 RON; break-even at 46 Standard salons by month 12'],
  ['tasks', 'text', 'id', 't013', 'Monthly cash-flow review against 6,380 RON monthly costs', 'Monthly cash-flow review against 6,860 RON monthly costs'],
  ['tasks', 'text', 'id', 't054', 'Milestone: 43 salons = break-even (6,450 RON/month on Standard)', 'Milestone: 46 salons = break-even (6,900 RON/month on Standard)'],
  ['roadmap_steps', 'text', 'id', 'c4', 'Reach 43 salons (break-even), then 50', 'Reach 46 salons (break-even), then 50'],
];
const WIKI_FROM = '- Break-even: 43 salons on Standard (monthly costs 6.380 RON)';
const WIKI_TO = '- Break-even: 46 salons on Standard (monthly costs 6.860 RON: 3.080 operational + 3.780 salaries)';

async function apply(knex: Knex, forward: boolean): Promise<void> {
  const [oldBe, newBe] = forward ? [43, 46] : [46, 43];
  const [oldCosts, newCosts] = forward ? [638000, 686000] : [686000, 638000];
  const [oldOps, newOps] = forward ? [260000, 308000] : [308000, 260000];
  await knex('plan_years').where({ year: 1, break_even_salons: oldBe }).update({ break_even_salons: newBe });
  await knex('plan_years').where({ year: 1, monthly_costs_bani: oldCosts }).update({ monthly_costs_bani: newCosts });
  await knex('plan_years').where({ year: 1, operational_costs_bani: oldOps }).update({ operational_costs_bani: newOps });

  for (const [table, column, key, id, from, to] of TEXTS) {
    const [a, b] = forward ? [from, to] : [to, from];
    if (await knex.schema.hasTable(table)) await knex(table).where({ [key]: id, [column]: a }).update({ [column]: b });
  }
  const [a, b] = forward ? [WIKI_FROM, WIKI_TO] : [WIKI_TO, WIKI_FROM];
  await knex.raw(`UPDATE wiki_pages SET body_md = replace(body_md, ?, ?) WHERE slug = 'plans-prices-and-offers'`, [a, b]);
}

export async function up(knex: Knex): Promise<void> {
  await apply(knex, true);
}

export async function down(knex: Knex): Promise<void> {
  await apply(knex, false);
}
