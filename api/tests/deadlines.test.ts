import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { addDays, today } from '../src/lib/dates.js';
import { APP_HEADER, AnyRow, createSalon, planId, signedIn } from './helpers.js';

describe('deadlines', () => {
  it('needs a session', async () => {
    expect((await request(createApp()).get('/api/v1/deadlines')).status).toBe(401);
  });

  it('are generated from domains, contracts and trials, and follow their dates', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent, { name: 'Barber House', domain: 'barberhouse.ro' });
    const domain = (await agent.get(`/api/v1/salons/${s.id}/domains`)).body.items[0];
    await agent.patch(`/api/v1/domains/${domain.id}`).set(APP_HEADER).send({ expiresOn: addDays(today(), 20), sslExpiresOn: addDays(today(), 60) });
    await agent.post('/api/v1/contracts').set(APP_HEADER).send({ salonId: s.id, kind: 'subscription', status: 'signed', signedOn: '2026-01-01', renewalOn: addDays(today(), 5) });
    await agent.post(`/api/v1/salons/${s.id}/subscriptions`).set(APP_HEADER).send({ planId: await planId(agent, 'standard'), trialEndsOn: addDays(today(), 10) });

    let items: AnyRow[] = (await agent.get('/api/v1/deadlines')).body.items;
    expect(items.map((d) => [d.category, d.daysLeft, d.salonName])).toEqual([
      ['contract_renewal', 5, 'Barber House'],
      ['trial_end', 10, 'Barber House'],
      ['domain_renewal', 20, 'Barber House'],
      ['domain_renewal', 60, 'Barber House'],
    ]);
    expect((await agent.get('/api/v1/deadlines/upcoming?days=15')).body.items).toHaveLength(2);

    // The domain is renewed for a year: the old deadline goes, the new one comes.
    await agent.patch(`/api/v1/domains/${domain.id}`).set(APP_HEADER).send({ expiresOn: addDays(today(), 385) });
    items = (await agent.get('/api/v1/deadlines')).body.items;
    expect(items.filter((d) => d.title.startsWith('Domain')).map((d) => d.daysLeft)).toEqual([385]);

    // Generated ones can be dismissed, not edited or deleted.
    const trial = items.find((d) => d.category === 'trial_end')!;
    expect((await agent.patch(`/api/v1/deadlines/${trial.id}`).set(APP_HEADER).send({ dueOn: '2030-01-01' })).status).toBe(409);
    expect((await agent.delete(`/api/v1/deadlines/${trial.id}`).set(APP_HEADER)).status).toBe(409);
    const dismissed = await agent.patch(`/api/v1/deadlines/${trial.id}`).set(APP_HEADER).send({ status: 'dismissed' });
    expect(dismissed.body.item.status).toBe('dismissed');
    // Regenerating keeps it dismissed.
    await agent.post('/api/v1/deadlines/regenerate').set(APP_HEADER);
    expect((await agent.get(`/api/v1/deadlines?status=dismissed`)).body.items).toHaveLength(1);
  });

  it('repeats a manual deadline when it is done', async () => {
    const { agent } = await signedIn();
    const bad = await agent.post('/api/v1/deadlines').set(APP_HEADER).send({ title: '', dueOn: '2026-02-30' });
    expect(bad.status).toBe(400);
    const d = (await agent.post('/api/v1/deadlines').set(APP_HEADER).send({ title: 'Monthly VAT return', category: 'tax', dueOn: '2026-01-31', recurrence: 'monthly', remindDays: [7, 1] })).body.item;
    expect(d).toMatchObject({ status: 'open', remindDays: [7, 1], sourceType: null });

    const done = await agent.post(`/api/v1/deadlines/${d.id}/done`).set(APP_HEADER);
    expect(done.body.item.status).toBe('done');
    expect(done.body.next).toMatchObject({ title: 'Monthly VAT return', dueOn: '2026-02-28', status: 'open', remindDays: [7, 1] });
    expect((await agent.post(`/api/v1/deadlines/${d.id}/done`).set(APP_HEADER)).status).toBe(409);

    const reopened = await agent.patch(`/api/v1/deadlines/${d.id}`).set(APP_HEADER).send({ status: 'open' });
    expect(reopened.body.item).toMatchObject({ status: 'open', doneAt: null });
    expect((await agent.delete(`/api/v1/deadlines/${d.id}`).set(APP_HEADER)).status).toBe(204);
  });
});
