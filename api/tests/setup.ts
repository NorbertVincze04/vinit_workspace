import { afterAll, beforeEach } from 'vitest';
import { db } from '../src/db/knex.js';
import { REFERENCE_TABLES, SNAPSHOT_SCHEMA } from './reference-tables.js';

/** Empties every table (except the migration bookkeeping) before each test, then restores the reference data. */
beforeEach(async () => {
  const rows = (await db.raw(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'knex_migrations%'`,
  )) as { rows: { tablename: string }[] };
  const tables = rows.rows.map((r) => `"${r.tablename}"`);
  if (tables.length) await db.raw(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
  for (const table of REFERENCE_TABLES) await db.raw(`INSERT INTO public.${table} SELECT * FROM ${SNAPSHOT_SCHEMA}.${table}`);
});

afterAll(async () => {
  await db.destroy();
});
