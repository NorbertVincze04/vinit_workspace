/**
 * Creates a workspace user (max 3). The first user becomes the owner.
 *   npm run user:create -- --email ana@vinit.ro --name "Ana Pop"
 * The password is asked for interactively (or taken from VINIT_PASSWORD for scripted setups).
 */
import { parseArgs } from 'node:util';
import { db } from '../db/knex.js';
import { HttpError } from '../http/errors.js';
import { createUser } from '../modules/auth/auth.service.js';
import { askHidden } from './prompt.js';

const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' } },
});

try {
  if (!values.email || !values.name) {
    throw new Error('Usage: npm run user:create -- --email you@example.com --name "Full Name" [--role owner|member]');
  }
  if (values.role && values.role !== 'owner' && values.role !== 'member') throw new Error('--role must be owner or member.');
  const password = process.env.VINIT_PASSWORD || (await askHidden('Password (min. 10 characters): '));
  if (!process.env.VINIT_PASSWORD && password !== (await askHidden('Repeat password: '))) {
    throw new Error('The passwords do not match.');
  }
  const user = await createUser({
    email: values.email,
    fullName: values.name,
    password,
    role: values.role as 'owner' | 'member' | undefined,
  });
  console.log(`Created ${user.role} ${user.fullName} <${user.email}>.`);
} catch (error) {
  const message =
    error instanceof HttpError
      ? error.message
      : error && typeof error === 'object' && 'issues' in error
        ? (error as { issues: { message: string }[] }).issues.map((i) => i.message).join(' ')
        : (error as Error).message;
  console.error(message);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
