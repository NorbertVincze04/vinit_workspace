import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { addDays, today } from '../src/lib/dates.js';
import { APP_HEADER, AnyRow, createSalon, signedIn } from './helpers.js';

describe('contracts', () => {
  it('needs a session', async () => {
    expect((await request(createApp()).get('/api/v1/contracts')).status).toBe(401);
  });

  it('numbers contracts per year and checks the dates', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent);
    const a = await agent.post('/api/v1/contracts').set(APP_HEADER).send({ salonId: s.id, kind: 'dpa', status: 'draft', startsOn: '2026-11-01' });
    expect(a.status).toBe(201);
    expect(a.body.item).toMatchObject({ number: `VIN-${today().slice(0, 4)}-001`, salonName: 'Barber House', clientName: 'Barber House SRL', files: 0 });
    const b = await agent.post('/api/v1/contracts').set(APP_HEADER).send({ salonId: s.id, kind: 'addendum', status: 'signed', signedOn: '2026-05-02' });
    expect(b.body.item.number).toBe('VIN-2026-002');

    const bad = await agent.post('/api/v1/contracts').set(APP_HEADER).send({ salonId: s.id, startsOn: '2026-12-01', endsOn: '2026-01-01' });
    expect(bad.status).toBe(400);
    const dup = await agent.post('/api/v1/contracts').set(APP_HEADER).send({ salonId: s.id, number: 'VIN-2026-002' });
    expect(dup.status).toBe(409);
  });

  it('signing the subscription contract stamps the salon and starts its onboarding', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent, { status: 'trial' });
    const c = (await agent.post('/api/v1/contracts').set(APP_HEADER).send({ salonId: s.id, kind: 'subscription', status: 'sent' })).body.item;
    expect((await agent.get(`/api/v1/salons/${s.id}`)).body.item.onboardingStatus).toBeNull();

    const signed = await agent.patch(`/api/v1/contracts/${c.id}`).set(APP_HEADER).send({ status: 'signed', signedOn: '2026-11-05' });
    expect(signed.body.item).toMatchObject({ status: 'signed', signedOn: '2026-11-05' });
    const salon = (await agent.get(`/api/v1/salons/${s.id}`)).body.item;
    expect(salon.onboardingStatus).toBe('in_progress');
    expect(salon.signedAt).toBeTruthy();

    const overview = (await agent.get(`/api/v1/salons/${s.id}/overview`)).body.contracts;
    expect(overview).toMatchObject({ contractSignedOn: '2026-11-05', dpaSignedOn: null });
  });

  it('lists compliance gaps: missing contract, missing DPA, renewals in 30 days', async () => {
    const { agent } = await signedIn();
    const ok = await createSalon(agent, { name: 'All signed', status: 'active' });
    const missing = await createSalon(agent, { name: 'Nothing signed', status: 'trial' });
    await createSalon(agent, { name: 'Just a lead', status: 'lead' });
    await agent.post('/api/v1/contracts').set(APP_HEADER).send({ salonId: ok.id, kind: 'subscription', status: 'signed', signedOn: '2026-01-10', renewalOn: addDays(today(), 10) });
    await agent.post('/api/v1/contracts').set(APP_HEADER).send({ salonId: ok.id, kind: 'dpa', status: 'signed', signedOn: '2026-01-10' });

    const rows: AnyRow[] = (await agent.get('/api/v1/contracts/compliance')).body.items;
    expect(rows.map((r) => [r.salonName, r.contractSignedOn, r.dpaSignedOn, !!r.renewalOn])).toEqual([
      ['All signed', '2026-01-10', '2026-01-10', true],
      ['Nothing signed', null, null, false],
    ]);
    expect(missing.id).toBeTruthy();
  });

  it('attaches files to a contract (and so to its salon)', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent);
    const other = await createSalon(agent, { name: 'Other' });
    const c = (await agent.post('/api/v1/contracts').set(APP_HEADER).send({ salonId: s.id, kind: 'dpa' })).body.item;
    const up = await agent
      .post('/api/v1/files')
      .set(APP_HEADER)
      .field('contractId', c.id)
      .field('name', 'DPA semnat.pdf')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'dpa.pdf', contentType: 'application/pdf' });
    expect(up.status).toBe(201);
    expect(up.body.item).toMatchObject({ salonId: s.id, contractId: c.id, name: 'DPA semnat.pdf' });

    const wrong = await agent
      .post('/api/v1/files')
      .set(APP_HEADER)
      .field('contractId', c.id)
      .field('salonId', other.id)
      .attach('file', Buffer.from('x'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(wrong.status).toBe(400);

    expect((await agent.get(`/api/v1/files?contractId=${c.id}`)).body.items).toHaveLength(1);
    expect((await agent.get(`/api/v1/contracts/${c.id}`)).body.item.files).toBe(1);
    expect((await agent.get(`/api/v1/salons/${s.id}/overview`)).body.contracts.files.map((f: AnyRow) => f.name)).toEqual(['DPA semnat.pdf']);
  });
});
