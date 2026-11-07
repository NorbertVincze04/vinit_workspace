import type { Knex } from 'knex';
import * as m001 from './001_foundation.js';
import * as m002 from './002_existing_tools.js';
import * as m003 from './003_clients_salons.js';
import * as m004 from './004_leads.js';
import * as m005 from './005_subscriptions.js';
import * as m006 from './006_onboarding.js';

interface Migration {
  name: string;
  module: Knex.Migration;
}

/**
 * Every migration, in order. Listed explicitly (instead of Knex scanning a folder) so the same
 * code works under tsx, in tests and in Docker without loader configuration.
 * Never rename or reorder an entry that has already run — add a new one.
 */
const MIGRATIONS: readonly Migration[] = [
  { name: '001_foundation', module: m001 },
  { name: '002_existing_tools', module: m002 },
  { name: '003_clients_salons', module: m003 },
  { name: '004_leads', module: m004 },
  { name: '005_subscriptions', module: m005 },
  { name: '006_onboarding', module: m006 },
];

export const migrationSource: Knex.MigrationSource<Migration> = {
  getMigrations: async () => [...MIGRATIONS],
  getMigrationName: (m) => m.name,
  getMigration: async (m) => m.module,
};

export const migrationConfig: Knex.MigratorConfig = { migrationSource, tableName: 'knex_migrations' };
