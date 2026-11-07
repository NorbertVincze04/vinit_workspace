import { db } from './db/knex.js';
import { regenerateDeadlines } from './modules/deadlines/deadlines.service.js';
import { ensureSnapshots } from './modules/kpis/kpis.service.js';
import { generateNotifications } from './modules/notifications/notifications.service.js';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

type Job = { name: string; run: () => Promise<unknown>; /** Default: hourly. */ everyMs?: number };

/**
 * Background work that must happen even though the PC isn't always on: every job runs at start-up
 * and then on its interval, and each one is idempotent (it only does what is missing).
 */
const JOBS: Job[] = [
  { name: 'KPI snapshots', run: () => ensureSnapshots(db) },
  { name: 'Deadlines', run: () => regenerateDeadlines(db) },
  // After the deadlines, so today's reminders are there. Every minute: reminders can be "5 minutes before".
  { name: 'Notifications', run: () => generateNotifications(db), everyMs: MINUTE },
];

async function run(jobs: readonly Job[]): Promise<void> {
  for (const job of jobs) {
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
  void run(JOBS);
  const timers = [...new Set(JOBS.map((j) => j.everyMs ?? HOUR))].map((ms) => {
    let busy = false;
    const timer = setInterval(() => {
      if (busy) return; // the previous round is still running
      busy = true;
      void run(JOBS.filter((j) => (j.everyMs ?? HOUR) === ms)).finally(() => (busy = false));
    }, ms);
    timer.unref();
    return timer;
  });
  return () => timers.forEach(clearInterval);
}

/** Lets other modules add a job (deadlines, …). */
export function addJob(job: Job): void {
  JOBS.push(job);
}
