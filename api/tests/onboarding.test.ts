import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { APP_HEADER, Agent, AnyRow, createSalon, signedIn } from './helpers.js';

const hoursAgo = (h: number): string => new Date(Date.now() - h * 3_600_000).toISOString();

async function start(agent: Agent, salonId: string, body: AnyRow = {}): Promise<AnyRow> {
  const res = await agent.post(`/api/v1/salons/${salonId}/onboarding`).set(APP_HEADER).send(body);
  if (res.status !== 201) throw new Error(`start failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.item;
}

describe('onboarding', () => {
  it('needs a session', async () => {
    expect((await request(createApp()).get('/api/v1/onboardings')).status).toBe(401);
  });

  it('starts with the template checklist and stamps the salon as signed', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent);
    const ob = await start(agent, s.id, { signedAt: '2026-11-05T10:00:00+02:00' });
    expect(ob.steps).toHaveLength(12);
    expect(ob.steps[0]).toMatchObject({ category: 'materials', title: 'Logo', doneAt: null });
    expect(ob).toMatchObject({ status: 'in_progress', stepsTotal: 12, stepsDone: 0, materialsReceivedAt: null, late: false, hoursUsed: null });
    expect((await agent.get(`/api/v1/salons/${s.id}`)).body.item).toMatchObject({ onboardingStatus: 'in_progress', onboardingLate: false });
    expect((await agent.get(`/api/v1/salons/${s.id}`)).body.item.signedAt).toBeTruthy();
    expect((await agent.post(`/api/v1/salons/${s.id}/onboarding`).set(APP_HEADER).send({})).status).toBe(409);
  });

  it('counts 48 hours from the materials, not from the signature', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent);
    const ob = await start(agent, s.id, { signedAt: hoursAgo(200) });
    expect(ob.late).toBe(false);
    expect(ob.hoursWaitingOnClient).toBeGreaterThan(199);

    const late = await agent.patch(`/api/v1/onboardings/${ob.id}`).set(APP_HEADER).send({ materialsReceivedAt: hoursAgo(50) });
    expect(late.body.item).toMatchObject({ late: true });
    expect(late.body.item.hoursUsed).toBeGreaterThanOrEqual(49.9);

    const open: AnyRow[] = (await agent.get('/api/v1/onboardings?open=true')).body.items;
    expect(open.map((o) => [o.salonName, o.late])).toEqual([['Barber House', true]]);
  });

  it('goes live: done, not late within 48h, salon live', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent);
    const ob = await start(agent, s.id, { signedAt: hoursAgo(100) });

    const early = await agent.post(`/api/v1/onboardings/${ob.id}/go-live`).set(APP_HEADER).send({});
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('no_materials');

    const materials = hoursAgo(60);
    await agent.patch(`/api/v1/onboardings/${ob.id}`).set(APP_HEADER).send({ materialsReceivedAt: materials });
    const wentLiveAt = new Date(new Date(materials).getTime() + 47 * 3_600_000).toISOString();
    const live = await agent.post(`/api/v1/onboardings/${ob.id}/go-live`).set(APP_HEADER).send({ wentLiveAt });
    expect(live.body.item).toMatchObject({ status: 'done', late: false, hoursUsed: 47 });

    const salon = (await agent.get(`/api/v1/salons/${s.id}`)).body.item;
    expect(salon).toMatchObject({ deployStatus: 'live', onboardingStatus: 'done' });
    expect(salon.goLiveOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await agent.get('/api/v1/onboardings?open=true')).body.items).toEqual([]);

    const timeline: AnyRow[] = (await agent.get(`/api/v1/salons/${s.id}/timeline`)).body.items;
    expect(timeline[0]).toMatchObject({ action: 'went_live' });
    expect(timeline[0].summary).toContain('47h after the materials');
  });

  it('ticks steps, adds custom ones, and needs a reason to block', async () => {
    const { agent, user } = await signedIn();
    const s = await createSalon(agent);
    const ob = await start(agent, s.id);
    const step = ob.steps[0];
    const done = await agent.patch(`/api/v1/onboarding-steps/${step.id}`).set(APP_HEADER).send({ done: true });
    expect(done.body.item.stepsDone).toBe(1);
    expect(done.body.item.steps[0]).toMatchObject({ doneByName: user.fullName });
    expect(done.body.item.steps[0].doneAt).toBeTruthy();

    const added = await agent.post(`/api/v1/onboardings/${ob.id}/steps`).set(APP_HEADER).send({ title: 'Import old bookings', category: 'setup' });
    expect(added.body.item.steps.at(-1)).toMatchObject({ title: 'Import old bookings', position: 12 });

    expect((await agent.patch(`/api/v1/onboardings/${ob.id}`).set(APP_HEADER).send({ status: 'blocked' })).status).toBe(400);
    const blocked = await agent.patch(`/api/v1/onboardings/${ob.id}`).set(APP_HEADER).send({ status: 'blocked', blockedReason: 'Waiting for the domain transfer' });
    expect(blocked.body.item).toMatchObject({ status: 'blocked', blockedReason: 'Waiting for the domain transfer' });
    const unblocked = await agent.patch(`/api/v1/onboardings/${ob.id}`).set(APP_HEADER).send({ status: 'in_progress' });
    expect(unblocked.body.item).toMatchObject({ status: 'in_progress', blockedReason: '' });
  });

  it('edits the template used by new onboardings', async () => {
    const { agent } = await signedIn();
    const bad = await agent.put('/api/v1/onboarding-template').set(APP_HEADER).send({ items: [] });
    expect(bad.status).toBe(400);
    const res = await agent
      .put('/api/v1/onboarding-template')
      .set(APP_HEADER)
      .send({ items: [{ title: 'Logo', category: 'materials' }, { title: 'Launch', category: 'launch' }] });
    expect(res.body.items.map((t: AnyRow) => [t.position, t.title])).toEqual([
      [0, 'Logo'],
      [1, 'Launch'],
    ]);
    const s = await createSalon(agent);
    expect((await start(agent, s.id)).steps).toHaveLength(2);
  });
});
