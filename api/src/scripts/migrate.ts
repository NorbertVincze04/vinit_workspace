/**
 * npm run db:migrate    → apply pending migrations
 * npm run db:rollback   → undo the last batch
 */
import { db } from '../db/knex.js';
import { migrationConfig } from '../db/migrations/index.js';

const command = process.argv[2] ?? 'latest';

try {
  if (command === 'latest') {
    const [batch, names] = await db.migrate.latest(migrationConfig);
    console.log(names.length ? `Batch ${batch}: ${names.join(', ')}` : 'Database is up to date.');
  } else if (command === 'rollback') {
    const [batch, names] = await db.migrate.rollback(migrationConfig);
    console.log(names.length ? `Rolled back batch ${batch}: ${names.join(', ')}` : 'Nothing to roll back.');
  } else {
    throw new Error(`Unknown command "${command}". Use latest or rollback.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
