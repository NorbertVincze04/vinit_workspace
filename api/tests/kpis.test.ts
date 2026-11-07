import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/knex.js';
import { ensureSnapshots } from '../src/modules/kpis/kpis.service.js';
import { APP_HEADER, Agent, AnyRow, createSalon, planId, promotionId, signedIn } from './helpers.js';

async function subscribe(agent: Agent, salonId: string, body: AnyRow): Promise<AnyRow> {
  const res = await agent.post(`/api/v1/salons/${salonId}/subscriptions`).set(APP_HEADER).send(body);
  if (res.status !== 201) throw new Error(`subscribe: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.item;
}
const change = (agent: Agent, id: string, body: AnyRow) => agent.post(`/api/v1/subscriptions/${id}/change`).set(APP_HEADER).send(body);
const kpis = async (agent: Agent, month: string): Promise<AnyRow> => (await agent.get(`/api/v1/kpis?month=${month}`)).body.kpis;

/** A: paying since January · B: Early Bird, converted in April · C: paying Feb, left in March · D: trial ended in March. */
async function story(agent: Agent): Promise<void> {
  const standard = await planId(agent, 'standard');
  const a = await createSalon(agent, { name: 'A' });
  const b = await createSalon(agent, { name: 'B' });
  const c = await createSalon(agent, { name: 'C' });
  const d = await createSalon(agent, { name: 'D' });
  await subscribe(agent, a.id, { planId: standard, startedOn: '2026-01-10' });
  const subB = await subscribe(agent, b.id, { planId: standard, promotionId: await promotionId(agent, 'early_bird'), startedOn: '2026-01-05' });
  await change(agent, subB.id, { kind: 'trial_converted', on: '2026-04-05' });
  const subC = await subscribe(agent, c.id, { planId: standard, startedOn: '2026-02-01' });
  await change(agent, subC.id, { kind: 'cancel', on: '2026-03-15', note: 'Closed the shop' });
  await subscribe(agent, d.id, { planId: standard, startedOn: '2026-03-01', trialEndsOn: '2026-03-31' });
  // An onboarding that went live in March, 34 hours after the materials.
  await db('onboardings').insert({ salonId: a.id, signedAt: '2026-03-09T08:00:00Z', materialsReceivedAt: '2026-03-10T10:00:00Z', wentLiveAt: '2026-03-11T20:00:00Z', status: 'done' });
}

describe('KPIs', () => {
  it('needs a session', async () => {
    expect((await request(createApp()).get('/api/v1/kpis')).status).toBe(401);
  });

  it('measures a month from the history: retention, churn, trials, onboarding', async () => {
    const { agent } = await signedIn();
    await story(agent);

    const march = await kpis(agent, '2026-03');
    expect(march).toMatchObject({
      month: '2026-03',
      payingAtStart: 2,
      paying: 1,
      mrrBani: 15000,
      churned: 1,
      retentionPct: 50,
      retentionYtdPct: null,
      trialsEnded: 1,
      trialsConverted: 0,
      trialToPaidPct: 0,
      onboardingsLive: 1,
      onboardingsWithin48h: 1,
      avgOnboardingHours: 34,
    });
    expect(march.salons).toMatchObject({ active: 1, trial: 2, churned: 1 });

    const april = await kpis(agent, '2026-04');
    expect(april).toMatchObject({ paying: 2, mrrBani: 30000, newPaying: 1, retentionPct: 100, trialsEnded: 1, trialsConverted: 1, trialToPaidPct: 100 });

    const res = await agent.get('/api/v1/kpis?month=2026-04');
    expect(res.body.targets).toMatchObject({ year: 1, breakEvenSalons: 43, payingSalons: 50, retentionPct: 70, onboardingHours: 48 });
  });

  it('freezes finished months, so later edits do not rewrite them', async () => {
    const { agent } = await signedIn();
    await story(agent);
    const written = await ensureSnapshots(db);
    expect(written[0]).toBe('2026-01');
    expect(await ensureSnapshots(db)).toEqual([]);

    // Someone backdates a new paying salon into March after the month was frozen.
    const late = await createSalon(agent, { name: 'Late entry' });
    await subscribe(agent, late.id, { planId: await planId(agent, 'premium'), startedOn: '2026-03-02' });
    expect(await kpis(agent, '2026-03')).toMatchObject({ paying: 1, snapshot: true });

    const history: AnyRow[] = (await agent.get('/api/v1/kpis/history?from=2026-02&to=2026-04')).body.items;
    expect(history.map((h) => [h.month, h.paying, h.snapshot])).toEqual([
      ['2026-02', 2, true],
      ['2026-03', 1, true],
      ['2026-04', 2, true],
    ]);

    const rebuilt = await agent.put('/api/v1/kpis/snapshots/2026-03').set(APP_HEADER);
    expect(rebuilt.body.kpis).toMatchObject({ paying: 2, mrrBani: 35000 });
    expect((await agent.put('/api/v1/kpis/snapshots/2099-01').set(APP_HEADER)).status).toBe(400);
  });
});
