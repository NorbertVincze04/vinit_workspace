import type { Knex } from 'knex';
import * as m001 from './001_foundation.js';
import * as m002 from './002_existing_tools.js';
import * as m003 from './003_clients_salons.js';
import * as m004 from './004_leads.js';
import * as m005 from './005_subscriptions.js';
import * as m006 from './006_onboarding.js';
import * as m007 from './007_support.js';
import * as m008 from './008_kpis.js';
import * as m009 from './009_feature_requests.js';
import * as m010 from './010_contracts.js';
import * as m011 from './011_deadlines.js';
import * as m012 from './012_wiki.js';
import * as m013 from './013_infra.js';
import * as m014 from './014_notifications.js';
import * as m015 from './015_deadline_times.js';

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
  { name: '007_support', module: m007 },
  { name: '008_kpis', module: m008 },
  { name: '009_feature_requests', module: m009 },
  { name: '010_contracts', module: m010 },
  { name: '011_deadlines', module: m011 },
  { name: '012_wiki', module: m012 },
  { name: '013_infra', module: m013 },
  { name: '014_notifications', module: m014 },
  { name: '015_deadline_times', module: m015 },
];

export const migrationSource: Knex.MigrationSource<Migration> = {
  getMigrations: async () => [...MIGRATIONS],
  getMigrationName: (m) => m.name,
  getMigration: async (m) => m.module,
};

export const migrationConfig: Knex.MigratorConfig = { migrationSource, tableName: 'knex_migrations' };
