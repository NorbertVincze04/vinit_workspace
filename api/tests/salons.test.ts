import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/knex.js';
import { APP_HEADER, AnyRow, createSalon, planId, signedIn } from './helpers.js';

describe('salon platform endpoints need a session', () => {
  it.each(['/clients', '/salons', '/plans', '/promotions', '/leads'])('GET %s → 401', async (path) => {
    expect((await request(createApp()).get(`/api/v1${path}`)).status).toBe(401);
  });
});

describe('plans and promotions', () => {
  it('come seeded with the business plan prices', async () => {
    const { agent } = await signedIn();
    const plans: AnyRow[] = (await agent.get('/api/v1/plans')).body.items;
    expect(plans.map((p) => [p.code, p.monthlyPriceBani, p.includedSessions])).toEqual([
      ['standard', 15000, 2],
      ['premium', 20000, 2],
      ['custom', 0, 3],
    ]);
    expect(plans.find((p) => p.code === 'custom')).toMatchObject({ oneOffFromBani: 100000, minTermMonths: 4 });
    expect(plans.find((p) => p.code === 'premium')?.includesSms).toBe(true);

    const promos: AnyRow[] = (await agent.get('/api/v1/promotions')).body.items;
    expect(promos.find((p) => p.code === 'early_bird')).toMatchObject({ freeMonths: 3, maxSalons: 50, used: 0 });
    expect(promos.find((p) => p.code === 'beta')).toBeTruthy();
  });

  it('edits a plan price in bani and rejects decimals', async () => {
    const { agent } = await signedIn();
    const id = await planId(agent, 'standard');
    expect((await agent.patch(`/api/v1/plans/${id}`).set(APP_HEADER).send({ monthlyPriceBani: 149.5 })).status).toBe(400);
    const res = await agent.patch(`/api/v1/plans/${id}`).set(APP_HEADER).send({ monthlyPriceBani: 16000 });
    expect(res.body.item.monthlyPriceBani).toBe(16000);
  });
});

describe('clients', () => {
  it('requires a name and a business address', async () => {
    const { agent } = await signedIn();
    const res = await agent.post('/api/v1/clients').set(APP_HEADER).send({ name: '  ', email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['name', 'businessAddress', 'email']));

    const created = await agent
      .post('/api/v1/clients')
      .set(APP_HEADER)
      .send({ name: 'Ana Pop', kind: 'person', businessAddress: 'Str. A 1' });
    expect(created.status).toBe(201);
    expect(created.body.item).toMatchObject({ name: 'Ana Pop', kind: 'person', salonId: null });
    const cleared = await agent.patch(`/api/v1/clients/${created.body.item.id}`).set(APP_HEADER).send({ businessAddress: '' });
    expect(cleared.status).toBe(400);
  });

  it('cannot be deleted while it still has a salon', async () => {
    const { agent } = await signedIn();
    const salon = await createSalon(agent);
    const res = await agent.delete(`/api/v1/clients/${salon.clientId}`).set(APP_HEADER);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('in_use');

    expect((await agent.delete(`/api/v1/salons/${salon.id}`).set(APP_HEADER)).status).toBe(204);
    expect((await agent.delete(`/api/v1/clients/${salon.clientId}`).set(APP_HEADER)).status).toBe(204);
  });
});

describe('salons', () => {
  it('creates a salon with a new client, plan and primary domain', async () => {
    const { agent } = await signedIn();
    const premium = await planId(agent, 'premium');
    const salon = await createSalon(agent, {
      planId: premium,
      status: 'trial',
      domain: 'https://BarberHouse.ro/',
      tenantSlug: 'barber-house',
    });
    expect(salon).toMatchObject({
      name: 'Barber House',
      status: 'trial',
      clientName: 'Barber House SRL',
      planCode: 'premium',
      primaryDomain: 'barberhouse.ro',
      tenantSlug: 'barber-house',
      clientAddressMissing: false,
    });

    expect((await agent.get('/api/v1/salons?q=barberhouse')).body.items).toHaveLength(1);
    expect((await agent.get('/api/v1/salons?status=active')).body.items).toHaveLength(0);
  });

  it('allows one salon per client', async () => {
    const { agent } = await signedIn();
    const salon = await createSalon(agent);
    const res = await agent.post('/api/v1/salons').set(APP_HEADER).send({ name: 'Second shop', clientId: salon.clientId });
    expect(res.status).toBe(409);
    expect(res.body.error.fields.clientId).toBeTruthy();

    expect((await agent.post('/api/v1/salons').set(APP_HEADER).send({ name: 'Orphan' })).status).toBe(400);
  });

  it('rejects a bad slug and a duplicate domain, rolling back the new client', async () => {
    const { agent } = await signedIn();
    const badSlug = await agent
      .post('/api/v1/salons')
      .set(APP_HEADER)
      .send({ name: 'X', tenantSlug: 'Bad Slug', client: { name: 'X', businessAddress: 'Y' } });
    expect(badSlug.status).toBe(400);

    await createSalon(agent, { domain: 'shop.ro' });
    const dup = await agent
      .post('/api/v1/salons')
      .set(APP_HEADER)
      .send({ name: 'Y', domain: 'shop.ro', client: { name: 'Y', businessAddress: 'Z' } });
    expect(dup.status).toBe(409);
    expect(await db('clients').where({ name: 'Y' }).first()).toBeUndefined();
  });

  it('changes status only through /status and keeps the history', async () => {
    const { agent, user } = await signedIn();
    const salon = await createSalon(agent, { status: 'trial' });
    expect((await agent.patch(`/api/v1/salons/${salon.id}`).set(APP_HEADER).send({ status: 'active' })).status).toBe(400);

    const active = await agent
      .post(`/api/v1/salons/${salon.id}/status`)
      .set(APP_HEADER)
      .send({ status: 'active' });
    expect(active.body.item.status).toBe('active');

    expect((await agent.post(`/api/v1/salons/${salon.id}/status`).set(APP_HEADER).send({ status: 'churned' })).status).toBe(400);
    const churned = await agent
      .post(`/api/v1/salons/${salon.id}/status`)
      .set(APP_HEADER)
      .send({ status: 'churned', reason: 'Closed the shop' });
    expect(churned.body.item).toMatchObject({ status: 'churned', churnReason: 'Closed the shop' });
    expect(churned.body.item.churnedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const overview = (await agent.get(`/api/v1/salons/${salon.id}/overview`)).body;
    expect(overview.client.name).toBe('Barber House SRL');
    expect(overview.history.map((h: AnyRow) => [h.fromStatus, h.toStatus])).toEqual([
      ['active', 'churned'],
      ['trial', 'active'],
      [null, 'trial'],
    ]);
    expect(overview.history[0].changedByName).toBe(user.fullName);

    const timeline: AnyRow[] = (await agent.get(`/api/v1/salons/${salon.id}/timeline`)).body.items;
    expect(timeline.map((a) => a.action)).toEqual(['status_changed', 'status_changed', 'created']);
  });

  it('keeps exactly one primary domain', async () => {
    const { agent } = await signedIn();
    const salon = await createSalon(agent, { domain: 'one.ro' });
    const two = await agent
      .post(`/api/v1/salons/${salon.id}/domains`)
      .set(APP_HEADER)
      .send({ domain: 'two.ro', passwordManagerRef: 'Bitwarden / Domains / two.ro' });
    expect(two.status).toBe(201);
    expect(two.body.item.isPrimary).toBe(false);

    await agent.patch(`/api/v1/domains/${two.body.item.id}`).set(APP_HEADER).send({ isPrimary: true, dnsStatus: 'verified' });
    let domains: AnyRow[] = (await agent.get(`/api/v1/salons/${salon.id}/domains`)).body.items;
    expect(domains.map((d) => [d.domain, d.isPrimary])).toEqual([
      ['two.ro', true],
      ['one.ro', false],
    ]);

    await agent.delete(`/api/v1/domains/${two.body.item.id}`).set(APP_HEADER);
    domains = (await agent.get(`/api/v1/salons/${salon.id}/domains`)).body.items;
    expect(domains).toMatchObject([{ domain: 'one.ro', isPrimary: true }]);
    expect((await agent.get(`/api/v1/salons/${salon.id}`)).body.item.primaryDomain).toBe('one.ro');
  });

  it('returns 404 for unknown salons and 400 for malformed ids', async () => {
    const { agent } = await signedIn();
    expect((await agent.get('/api/v1/salons/00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await agent.get('/api/v1/salons/not-a-uuid')).status).toBe(400);
  });
});
