/**
 * Database backups for the Docker setup. Run from the api/ folder (or via the root npm scripts).
 *
 *   npm run db:backup                              → backups/vinit-2026-11-07-1530.dump
 *   npm run db:restore -- backups/<file>.dump --yes → replaces the database with that backup
 *
 * Uses pg_dump / pg_restore inside the "db" container, so nothing extra needs installing.
 * The dumps contain everything (including uploaded files): keep them somewhere safe.
 */
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const [command = 'backup', file, flag] = process.argv.slice(2);

function compose(args: string[]): ReturnType<typeof spawn> {
  return spawn('docker', ['compose', 'exec', '-T', 'db', ...args], { cwd: ROOT, stdio: ['pipe', 'pipe', 'inherit'] });
}

function finished(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((ok, fail) => {
    child.on('error', fail);
    child.on('close', (code) => (code === 0 ? ok() : fail(new Error(`docker exited with code ${code}. Is the database running? (docker compose up -d db)`))));
  });
}

async function backup(): Promise<void> {
  const dir = join(ROOT, 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Bucharest' }).slice(0, 16).replace(' ', '-').replace(':', '');
  const out = join(dir, `vinit-${stamp}.dump`);
  const child = compose(['pg_dump', '-U', 'vinit', '-d', 'vinit', '-Fc']);
  child.stdin!.end();
  child.stdout!.pipe(createWriteStream(out));
  await finished(child);
  console.log(`Backup written: ${out} (${(statSync(out).size / 1024 / 1024).toFixed(1)} MB)`);
}

async function restore(): Promise<void> {
  if (!file || !existsSync(file)) throw new Error('Usage: npm run db:restore -- <path to .dump> --yes');
  if (flag !== '--yes') throw new Error('This replaces ALL data in the "vinit" database. Add --yes to confirm.');
  const child = compose(['pg_restore', '-U', 'vinit', '-d', 'vinit', '--clean', '--if-exists', '--no-owner']);
  child.stdout!.pipe(process.stdout);
  createReadStream(file).pipe(child.stdin!);
  await finished(child);
  console.log(`Restored ${file}. Restart the API (docker compose restart api).`);
}

(command === 'restore' ? restore() : backup()).catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
