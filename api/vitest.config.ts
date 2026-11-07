import { defineConfig } from 'vitest/config';

/**
 * API tests run against the real Postgres from docker-compose (database "vinit_test").
 * Start it first: docker compose up -d db
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/setup.ts'],
    // One shared database: run files one after another.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DB_NAME: 'vinit_test',
      JWT_SECRET: 'test-secret-that-is-long-enough-for-the-config-check',
    },
  },
});
