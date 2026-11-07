import { afterAll, beforeEach } from 'vitest';
import { db } from '../src/db/knex.js';

/** Empties every table (except the migration bookkeeping) before each test. */
beforeEach(async () => {
  const rows = (await db.raw(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'knex_migrations%'`,
  )) as { rows: { tablename: string }[] };
  const tables = rows.rows.map((r) => `"${r.tablename}"`);
  if (tables.length) await db.raw(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await db.destroy();
});
