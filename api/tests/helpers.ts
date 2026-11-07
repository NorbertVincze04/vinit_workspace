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

export type Agent = Awaited<ReturnType<typeof signedIn>>['agent'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRow = Record<string, any>;

/** Id of a seeded plan ("standard", "premium", "custom"). */
export async function planId(agent: Agent, code: string): Promise<string> {
  const res = await agent.get('/api/v1/plans');
  const plan = (res.body.items as { id: string; code: string }[]).find((p) => p.code === code);
  if (!plan) throw new Error(`no plan ${code}`);
  return plan.id;
}

/** Id of a seeded promotion ("early_bird", "beta"…). */
export async function promotionId(agent: Agent, code: string): Promise<string> {
  const res = await agent.get('/api/v1/promotions');
  const promo = (res.body.items as { id: string; code: string }[]).find((p) => p.code === code);
  if (!promo) throw new Error(`no promotion ${code}`);
  return promo.id;
}

/** Creates a salon together with a new client; returns the salon row. */
export async function createSalon(agent: Agent, salon: AnyRow = {}, client: AnyRow = {}): Promise<AnyRow> {
  const res = await agent
    .post('/api/v1/salons')
    .set(APP_HEADER)
    .send({
      name: 'Barber House',
      city: 'Cluj-Napoca',
      ...salon,
      client: { name: `${salon['name'] ?? 'Barber House'} SRL`, businessAddress: 'Str. Memorandumului 1, Cluj-Napoca', ...client },
    });
  if (res.status !== 201) throw new Error(`createSalon failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.item as AnyRow;
}
