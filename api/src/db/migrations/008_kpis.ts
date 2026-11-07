import type { Knex } from 'knex';

/**
 * Phase 3, module 1: KPI snapshots. KPIs are rebuilt from the history (status history,
 * subscription changes, onboardings, leads); when a month is over its figures are frozen here,
 * so later edits don't rewrite past trends. `data` holds the whole computed month.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE kpi_snapshots (
      month       text PRIMARY KEY CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
      data        jsonb NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS kpi_snapshots');
}
