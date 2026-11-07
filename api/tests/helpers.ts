import request from 'supertest';
import { createApp } from '../src/app.js';
import { createUser } from '../src/modules/auth/auth.service.js';

export const PASSWORD = 'correct-horse-battery';

/** Header every write needs (see requireAppHeader). */
export const APP_HEADER = { 'X-Requested-With': 'vinit-tests' } as const;

export async function makeUser(email = 'owner@vinit.test', fullName = 'Test Owner') {
  return createUser({ email, fullName, password: PASSWORD });
}

/** A supertest agent with a fresh app, a user and a session cookie. */
export async function signedIn(email = 'owner@vinit.test') {
  const app = createApp();
  const user = await makeUser(email);
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').set(APP_HEADER).send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { app, agent, user };
}
