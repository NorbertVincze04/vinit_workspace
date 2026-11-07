import { db } from './db/knex.js';
import { ensureSnapshots } from './modules/kpis/kpis.service.js';

type Job = { name: string; run: () => Promise<unknown> };

/**
 * Background work that must happen even though the PC isn't always on: every job runs at start-up
 * and then every few hours, and each one is idempotent (it only does what is missing).
 */
const JOBS: Job[] = [{ name: 'KPI snapshots', run: () => ensureSnapshots(db) }];

const EVERY_MS = 6 * 60 * 60 * 1000;

async function runAll(): Promise<void> {
  for (const job of JOBS) {
    try {
      const result = await job.run();
      if (Array.isArray(result) && result.length) console.log(`${job.name}: ${result.length} done`);
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
