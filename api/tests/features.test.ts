import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { APP_HEADER, AnyRow, createSalon, planId, signedIn } from './helpers.js';

describe('feature requests', () => {
  it.each(['/feature-requests', '/roadmap-steps'])('GET %s needs a session', async (path) => {
    expect((await request(createApp()).get(`/api/v1${path}`)).status).toBe(401);
  });

  it('has the roadmap steps with the app’s ids', async () => {
    const { agent } = await signedIn();
    const steps: AnyRow[] = (await agent.get('/api/v1/roadmap-steps')).body.items;
    expect(steps).toHaveLength(22);
    expect(steps[0]).toMatchObject({ id: 'b1', phase: 'build' });
    expect(steps.find((s) => s.id === 'p2')?.text).toContain('SMS reminders');
  });

  it('ranks requests by the MRR of the salons that asked, then by votes', async () => {
    const { agent } = await signedIn();
    const premium = await planId(agent, 'premium');
    const paying = await createSalon(agent, { name: 'Paying' });
    await agent.post(`/api/v1/salons/${paying.id}/subscriptions`).set(APP_HEADER).send({ planId: premium });
    const free = await createSalon(agent, { name: 'Free' });
    const lead = (await agent.post('/api/v1/leads').set(APP_HEADER).send({ businessName: 'Prospect' })).body.item;

    const a = (await agent.post('/api/v1/feature-requests').set(APP_HEADER).send({ title: 'Online deposits', roadmapStepId: 'c5' })).body.item;
    const b = (await agent.post('/api/v1/feature-requests').set(APP_HEADER).send({ title: 'Dark mode' })).body.item;
    expect(a).toMatchObject({ status: 'new', votes: 0, roadmapStepText: expect.stringContaining('add-ons') });

    await agent.post(`/api/v1/feature-requests/${b.id}/votes`).set(APP_HEADER).send({ salonId: free.id });
    await agent.post(`/api/v1/feature-requests/${b.id}/votes`).set(APP_HEADER).send({ leadId: lead.id, note: 'Would sign for it' });
    const vote = await agent.post(`/api/v1/feature-requests/${a.id}/votes`).set(APP_HEADER).send({ salonId: paying.id });
    expect(vote.body.item).toMatchObject({ votes: 1, salonVotes: 1, mrrBani: 20000 });
    expect((await agent.post(`/api/v1/feature-requests/${a.id}/votes`).set(APP_HEADER).send({ salonId: paying.id })).status).toBe(409);
    expect((await agent.post(`/api/v1/feature-requests/${a.id}/votes`).set(APP_HEADER).send({})).status).toBe(400);

    const list: AnyRow[] = (await agent.get('/api/v1/feature-requests')).body.items;
    expect(list.map((r) => [r.title, r.votes, r.mrrBani])).toEqual([
      ['Online deposits', 1, 20000],
      ['Dark mode', 2, 0],
    ]);

    const detail = (await agent.get(`/api/v1/feature-requests/${b.id}`)).body.item;
    expect(detail.voteList.map((v: AnyRow) => v.salonName ?? v.leadName)).toEqual(['Free', 'Prospect']);
    expect((await agent.get(`/api/v1/salons/${paying.id}/overview`)).body.features.map((f: AnyRow) => f.title)).toEqual(['Online deposits']);
  });

  it('stamps the shipping date and tells the salons that asked', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent);
    const fr = (await agent.post('/api/v1/feature-requests').set(APP_HEADER).send({ title: 'Waitlist' })).body.item;
    await agent.post(`/api/v1/feature-requests/${fr.id}/votes`).set(APP_HEADER).send({ salonId: s.id });
    const shipped = await agent.patch(`/api/v1/feature-requests/${fr.id}`).set(APP_HEADER).send({ status: 'shipped' });
    expect(shipped.body.item.shippedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const timeline: AnyRow[] = (await agent.get(`/api/v1/salons/${s.id}/timeline`)).body.items;
    expect(timeline[0]).toMatchObject({ action: 'shipped', summary: 'Shipped what they asked for: Waitlist' });
    const reopened = await agent.patch(`/api/v1/feature-requests/${fr.id}`).set(APP_HEADER).send({ status: 'planned' });
    expect(reopened.body.item.shippedOn).toBeNull();
  });

  it('turns a change-request ticket into a feature request with the salon’s vote', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent);
    const t = (await agent.post('/api/v1/tickets').set(APP_HEADER).send({ salonId: s.id, title: 'Loyalty card', type: 'change_request', description: 'Stamp after 10 cuts' })).body.item;
    const res = await agent.post(`/api/v1/tickets/${t.id}/to-feature-request`).set(APP_HEADER);
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ title: 'Loyalty card', description: 'Stamp after 10 cuts', votes: 1, tickets: 1 });
    expect((await agent.get(`/api/v1/tickets/${t.id}`)).body.item).toMatchObject({ featureRequestId: res.body.item.id, featureRequestTitle: 'Loyalty card' });
    expect((await agent.post(`/api/v1/tickets/${t.id}/to-feature-request`).set(APP_HEADER)).status).toBe(409);
  });
});
