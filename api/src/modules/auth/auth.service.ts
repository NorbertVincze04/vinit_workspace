import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Knex } from 'knex';
import { z } from 'zod';
import { config } from '../../config.js';
import { db } from '../../db/knex.js';
import { HttpError } from '../../http/errors.js';

export type Role = 'owner' | 'member';

/** What the API returns about a user (never the hash). */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

interface UserRow extends PublicUser {
  passwordHash: string;
  isActive: boolean;
  tokenVersion: number;
}

export interface SessionClaims {
  sub: string;
  /** users.token_version when the token was issued. */
  tv: number;
  iat: number;
}

const ROUNDS = config.isTest ? 4 : 12;
// Compared against when the email is unknown, so both cases take the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', ROUNDS);

export const emailSchema = z.email('Enter a valid email address.').max(254).transform((v) => v.trim().toLowerCase());
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(200, 'Use at most 200 characters.');
export const fullNameSchema = z.string().trim().min(1, 'Enter a name.').max(120);

export const toPublic = (u: UserRow): PublicUser => ({ id: u.id, email: u.email, fullName: u.fullName, role: u.role });

export async function findUserById(id: string, trx: Knex = db): Promise<UserRow | undefined> {
  return trx<UserRow>('users').where({ id }).first();
}

/** Returns the user when the email and password match an active account, otherwise null. */
export async function verifyCredentials(email: string, password: string): Promise<UserRow | null> {
  const user = await db<UserRow>('users').where({ email }).first();
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  return user && ok && user.isActive ? user : null;
}

/** Creates a team member. The workspace allows at most config.maxUsers active accounts. */
export async function createUser(input: { email: string; fullName: string; password: string; role?: Role }): Promise<PublicUser> {
  const email = emailSchema.parse(input.email);
  const fullName = fullNameSchema.parse(input.fullName);
  const password = passwordSchema.parse(input.password);

  return db.transaction(async (trx) => {
    // Serialise concurrent sign-ups so the limit can't be passed by racing.
    await trx.raw('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    const [{ count }] = await trx('users').where({ isActive: true }).count<{ count: number }[]>({ count: '*' });
    if (count >= config.maxUsers) {
      throw new HttpError(409, 'user_limit', `The workspace already has ${config.maxUsers} active users.`);
    }
    const role: Role = input.role ?? (count === 0 ? 'owner' : 'member');
    const [row] = await trx<UserRow>('users')
      .insert({ email, fullName, role, passwordHash: await bcrypt.hash(password, ROUNDS) } as never)
      .returning('*');
    return toPublic(row);
  });
}

/** Sets a new password and signs the user out everywhere (token_version + 1). */
export async function setPassword(userId: string, password: string): Promise<UserRow> {
  const hash = await bcrypt.hash(passwordSchema.parse(password), ROUNDS);
  const [row] = await db<UserRow>('users')
    .where({ id: userId })
    .update({ passwordHash: hash, tokenVersion: db.raw('token_version + 1') } as never)
    .returning('*');
  if (!row) throw new HttpError(404, 'not_found', 'User not found.');
  return row;
}

export async function checkPassword(user: UserRow, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}

export function signSession(user: { id: string; tokenVersion: number }): string {
  return jwt.sign({ tv: user.tokenVersion }, config.jwtSecret, {
    subject: user.id,
    expiresIn: `${config.sessionDays}d`,
    algorithm: 'HS256',
  });
}

export function readSession(token: string): SessionClaims | null {
  try {
    const claims = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as Partial<SessionClaims>;
    return typeof claims.sub === 'string' && typeof claims.tv === 'number' && typeof claims.iat === 'number'
      ? (claims as SessionClaims)
      : null;
  } catch {
    return null;
  }
}

export type { UserRow };
