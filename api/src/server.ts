import { createApp } from './app.js';
import { config } from './config.js';
import { db } from './db/knex.js';
import { startJobs } from './jobs.js';

const server = createApp().listen(config.port, () => {
  console.log(`VINIT API listening on http://localhost:${config.port}/api/v1`);
});
const stopJobs = startJobs();

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received, closing…`);
  stopJobs();
  server.close();
  await db.destroy();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
