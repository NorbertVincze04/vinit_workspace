import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const env = process.env;

function required(name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} must be set (see api/.env.example).`);
  return value;
}

function trustProxy(raw = ''): boolean | number {
  const v = raw.trim().toLowerCase();
  if (v === '' || v === 'false') return false;
  if (v === 'true') return true;
  return Number.isInteger(Number(v)) ? Number(v) : false;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters long.');

export const config = {
  env: env.NODE_ENV ?? 'development',
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT ?? 3000),
  db: {
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 5433),
    user: env.DB_USER ?? 'vinit',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_NAME ?? 'vinit',
  },
  jwtSecret,
  /** Session length. GET /auth/me re-issues the cookie once a day, so active users stay signed in. */
  sessionDays: 7,
  cookieName: 'vinit_session',
  cookieSecure: env.COOKIE_SECURE === 'true',
  trustProxy: trustProxy(env.TRUST_PROXY),
  /** The workspace is for the team only (max 3 people). */
  maxUsers: 3,
  maxFileBytes: 50 * 1024 * 1024,
  timezone: 'Europe/Bucharest',
} as const;
