import { db } from './db/knex.js';
import { regenerateDeadlines } from './modules/deadlines/deadlines.service.js';
import { ensureSnapshots } from './modules/kpis/kpis.service.js';
import { generateNotifications } from './modules/notifications/notifications.service.js';

type Job = { name: string; run: () => Promise<unknown> };

/**
 * Background work that must happen even though the PC isn't always on: every job runs at start-up
 * and then every few hours, and each one is idempotent (it only does what is missing).
 */
const JOBS: Job[] = [
  { name: 'KPI snapshots', run: () => ensureSnapshots(db) },
  { name: 'Deadlines', run: () => regenerateDeadlines(db) },
  // After the deadlines, so today's reminders are there.
  { name: 'Notifications', run: () => generateNotifications(db) },
];

/** Hourly: cheap (a few hundred rows), and notifications should not wait long. */
const EVERY_MS = 60 * 60 * 1000;

async function runAll(): Promise<void> {
  for (const job of JOBS) {
    try {
      const result = await job.run();
      const count = Array.isArray(result) ? result.length : typeof result === 'number' ? result : 0;
      if (count) console.log(`${job.name}: ${count} done`);
    } catch (error) {
      console.error(`${job.name} failed:`, (error as Error).message);
    }
  }
}

/** Starts the jobs (not in tests). Returns a function that stops them. */
export function startJobs(): () => void {
  void runAll();
  const timer = setInterval(() => void runAll(), EVERY_MS);
  timer.unref();
  return () => clearInterval(timer);
}

/** Lets other modules add a job (deadlines, …). */
export function addJob(job: Job): void {
  JOBS.push(job);
}
