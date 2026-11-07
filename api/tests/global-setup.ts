/** Rebuilds the test database schema from scratch once per test run. */
export default async function setup(): Promise<void> {
  process.env.NODE_ENV = 'test';
  process.env.DB_NAME = 'vinit_test';
  process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-for-the-config-check';

  const { createKnex } = await import('../src/db/knex.js');
  const { migrationConfig } = await import('../src/db/migrations/index.js');
  const knex = createKnex();
  try {
    await knex.raw('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await knex.migrate.latest(migrationConfig);
  } catch (error) {
    throw new Error(
      `Could not prepare the test database (is it running? → docker compose up -d db): ${(error as Error).message}`,
    );
  } finally {
    await knex.destroy();
  }
}
