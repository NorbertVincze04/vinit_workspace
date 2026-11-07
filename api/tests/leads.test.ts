import { describe, expect, it } from 'vitest';
import { APP_HEADER, Agent, AnyRow, planId, signedIn } from './helpers.js';

async function lead(agent: Agent, data: AnyRow = {}): Promise<AnyRow> {
  const res = await agent
    .post('/api/v1/leads')
    .set(APP_HEADER)
    .send({ businessName: 'Barber Club', city: 'Iași', phone: '0740 000 111', source: 'instagram_dm', ...data });
  if (res.status !== 201) throw new Error(`lead failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.item;
}

const board = async (agent: Agent): Promise<AnyRow[]> => (await agent.get('/api/v1/leads')).body.items;
const column = (items: AnyRow[], stage: string): string[] =>
  items.filter((l) => l.stage === stage).map((l) => l.businessName as string);

describe('leads', () => {
  it('creates leads at the end of their column, owned by the creator', async () => {
    const { agent, user } = await signedIn();
    const a = await lead(agent, { businessName: 'A' });
    const b = await lead(agent, { businessName: 'B' });
    expect(a).toMatchObject({ stage: 'contacted', stagePosition: 0, ownerName: user.fullName });
    expect(b.stagePosition).toBe(1);

    const bad = await agent.post('/api/v1/leads').set(APP_HEADER).send({ businessName: '', source: 'tiktok', stage: 'paying' });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.error.fields)).toEqual(expect.arrayContaining(['businessName', 'source', 'stage']));
  });

  it('moves cards between columns and keeps the order', async () => {
    const { agent } = await signedIn();
    const a = await lead(agent, { businessName: 'A' });
    await lead(agent, { businessName: 'B' });
    await lead(agent, { businessName: 'C', stage: 'replied' });

    const moved = await agent.post(`/api/v1/leads/${a.id}/move`).set(APP_HEADER).send({ stage: 'replied', position: 0 });
    expect(moved.status).toBe(200);
    expect(column(moved.body.items, 'replied')).toEqual(['A', 'C']);
    expect(column(moved.body.items, 'contacted')).toEqual(['B']);

    await agent.post(`/api/v1/leads/${a.id}/move`).set(APP_HEADER).send({ stage: 'replied', position: 5 });
    expect(column(await board(agent), 'replied')).toEqual(['C', 'A']);

    const detail = (await agent.get(`/api/v1/leads/${a.id}`)).body;
    expect(detail.activities.map((x: AnyRow) => [x.kind, x.fromStage, x.toStage])).toEqual([['stage_change', 'contacted', 'replied']]);
  });

  it('needs a reason to mark a lead lost, and conversion to reach trial or paying', async () => {
    const { agent } = await signedIn();
    const a = await lead(agent);
    expect((await agent.post(`/api/v1/leads/${a.id}/move`).set(APP_HEADER).send({ stage: 'lost' })).status).toBe(400);
    const lost = await agent.post(`/api/v1/leads/${a.id}/move`).set(APP_HEADER).send({ stage: 'lost', lostReason: 'price', lostNote: 'Too expensive' });
    expect(lost.body.items[0]).toMatchObject({ stage: 'lost', lostReason: 'price', lostNote: 'Too expensive' });

    const trial = await agent.post(`/api/v1/leads/${a.id}/move`).set(APP_HEADER).send({ stage: 'trial' });
    expect(trial.status).toBe(409);
    expect(trial.body.error.code).toBe('convert_first');

    // Back to an open stage clears the reason.
    const back = await agent.post(`/api/v1/leads/${a.id}/move`).set(APP_HEADER).send({ stage: 'replied' });
    expect(back.body.items[0]).toMatchObject({ stage: 'replied', lostReason: null, lostNote: '' });
  });

  it('logs contacts and filters follow-ups that are due', async () => {
    const { agent } = await signedIn();
    const a = await lead(agent, { businessName: 'Late', nextFollowUpOn: '2020-01-01' });
    await lead(agent, { businessName: 'Later', nextFollowUpOn: '2099-01-01' });
    await lead(agent, { businessName: 'None' });

    const due = (await agent.get('/api/v1/leads?due=overdue')).body.items;
    expect(due.map((l: AnyRow) => l.businessName)).toEqual(['Late']);

    expect((await agent.post(`/api/v1/leads/${a.id}/activities`).set(APP_HEADER).send({ kind: 'call', body: '' })).status).toBe(400);
    const call = await agent.post(`/api/v1/leads/${a.id}/activities`).set(APP_HEADER).send({ kind: 'call', body: 'Called, demo next week' });
    expect(call.status).toBe(201);
    expect((await agent.get(`/api/v1/leads/${a.id}`)).body.item.lastActivityAt).toBeTruthy();
  });

  it('converts a lead into a client + salon, and the stage then follows the salon', async () => {
    const { agent } = await signedIn();
    const premium = await planId(agent, 'premium');
    const a = await lead(agent, { businessName: 'Barber Club', city: 'Iași', interestedPlanId: premium, stage: 'replied' });

    const res = await agent
      .post(`/api/v1/leads/${a.id}/convert`)
      .set(APP_HEADER)
      .send({ client: { name: 'Barber Club SRL', businessAddress: 'Bd. Ștefan cel Mare 1, Iași' }, salon: { domain: 'barberclub.ro' } });
    expect(res.status).toBe(201);
    expect(res.body.salon).toMatchObject({ name: 'Barber Club', city: 'Iași', status: 'trial', planCode: 'premium', leadId: a.id, primaryDomain: 'barberclub.ro' });
    expect(res.body.lead).toMatchObject({ stage: 'trial', convertedSalonId: res.body.salon.id, convertedSalonName: 'Barber Club' });

    expect((await agent.post(`/api/v1/leads/${a.id}/convert`).set(APP_HEADER).send({ client: { name: 'X', businessAddress: 'Y' } })).status).toBe(409);
    expect((await agent.post(`/api/v1/leads/${a.id}/move`).set(APP_HEADER).send({ stage: 'replied' })).body.error.code).toBe('follows_salon');

    const salonId = res.body.salon.id;
    await agent.post(`/api/v1/salons/${salonId}/status`).set(APP_HEADER).send({ status: 'active' });
    expect((await agent.get(`/api/v1/leads/${a.id}`)).body.item.stage).toBe('paying');

    const overview = (await agent.get(`/api/v1/salons/${salonId}/overview`)).body;
    expect(overview.lead).toMatchObject({ businessName: 'Barber Club', source: 'instagram_dm' });
    expect(overview.lead.activities.map((x: AnyRow) => x.toStage)).toEqual(['paying', 'trial']);
  });

  it('imports rows and skips duplicates (same name and phone)', async () => {
    const { agent } = await signedIn();
    await lead(agent, { businessName: 'Barber Club', phone: '+40 740 000 111' });
    const res = await agent
      .post('/api/v1/leads/import')
      .set(APP_HEADER)
      .send({
        rows: [
          { businessName: 'Barber Club', phone: '0740000111' },
          { businessName: 'Salon Ana', city: 'Pitești', employees: 3 },
          { businessName: 'Salon Ana', city: 'Pitești' },
        ],
      });
    expect(res.body).toEqual({ created: 1, skipped: ['Barber Club', 'Salon Ana'] });
    expect(column(await board(agent), 'contacted')).toEqual(['Barber Club', 'Salon Ana']);

    const invalid = await agent.post('/api/v1/leads/import').set(APP_HEADER).send({ rows: [{ businessName: 'X', employees: -1 }] });
    expect(invalid.status).toBe(400);
  });
});
