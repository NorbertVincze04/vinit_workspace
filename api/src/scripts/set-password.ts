/**
 * Resets a user's password (signs them out everywhere).
 *   npm run user:password -- --email ana@vinit.ro
 */
import { parseArgs } from 'node:util';
import { db } from '../db/knex.js';
import { emailSchema, setPassword } from '../modules/auth/auth.service.js';
import { askHidden } from './prompt.js';

const { values } = parseArgs({ options: { email: { type: 'string' } } });

try {
  if (!values.email) throw new Error('Usage: npm run user:password -- --email you@example.com');
  const user = await db('users').where({ email: emailSchema.parse(values.email) }).first();
  if (!user) throw new Error(`No user with email ${values.email}.`);
  const password = process.env.VINIT_PASSWORD || (await askHidden('New password (min. 10 characters): '));
  if (!process.env.VINIT_PASSWORD && password !== (await askHidden('Repeat password: '))) {
    throw new Error('The passwords do not match.');
  }
  await setPassword(user.id, password);
  console.log(`Password changed for ${values.email}. Their other sessions are signed out.`);
} catch (error) {
  const e = error as { issues?: { message: string }[]; message?: string };
  console.error(e.issues ? e.issues.map((i) => i.message).join(' ') : e.message);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
