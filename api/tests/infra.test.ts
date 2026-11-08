import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { addDays, monthOf, today } from '../src/lib/dates.js';
import { APP_HEADER, AnyRow, createSalon, planId, signedIn } from './helpers.js';

describe('infra', () => {
  it.each(['/infra/services', '/infra/health', '/infra/sms-usage', '/infra/backup-checks'])('GET %s needs a session', async (path) => {
    expect((await request(createApp()).get(`/api/v1${path}`)).status).toBe(401);
  });

  it('takes the cost from the linked Finances payment (decision G), else the estimate, in RON', async () => {
    const { agent } = await signedIn();
    await agent.put('/api/v1/settings/finances.rates').set(APP_HEADER).send({ value: { eur: 5, usd: 4.5 } });
    await agent.post('/api/v1/finances/recurring').set(APP_HEADER).send({ id: 'twilio', name: 'Twilio', amountBani: 90000, frequency: 'quarterly', currency: 'RON' });

    const linked = await agent.post('/api/v1/infra/services').set(APP_HEADER).send({ name: 'Twilio SMS', category: 'sms', recurringId: 'twilio', monthlyCostBani: 1 });
    expect(linked.status).toBe(201);
    expect(linked.body.item).toMatchObject({ costSource: 'finances', monthlyBani: 30000, monthlyRonBani: 30000, recurringName: 'Twilio' });

    const estimate = await agent.post('/api/v1/infra/services').set(APP_HEADER).send({ name: 'Domain hosting', category: 'hosting', monthlyCostBani: 1000, currency: 'EUR' });
    expect(estimate.body.item).toMatchObject({ costSource: 'estimate', monthlyCurrency: 'EUR', monthlyRonBani: 5000 });

    const bad = await agent.post('/api/v1/infra/services').set(APP_HEADER).send({ name: 'x', dashboardUrl: 'not a url', category: 'cloud' });
    expect(bad.status).toBe(400);

    const health = (await agent.get('/api/v1/infra/health')).body;
    expect(health.costs).toMatchObject({ monthlyRonBani: 35000, planBani: 308000, services: 2 });

    // Deleting the Finances payment keeps the service, without a cost source.
    await agent.delete('/api/v1/finances/recurring/twilio').set(APP_HEADER);
    const after: AnyRow[] = (await agent.get('/api/v1/infra/services')).body.items;
    expect(after.find((s) => s.name === 'Twilio SMS')).toMatchObject({ recurringId: null, costSource: 'estimate', monthlyBani: 1 });
  });

  it('tracks SMS against the 1,500 budget, one number per month and salon', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent);
    await agent.post(`/api/v1/salons/${s.id}/subscriptions`).set(APP_HEADER).send({ planId: await planId(agent, 'premium') });
    const month = monthOf(today());
    await agent.put('/api/v1/infra/sms-usage').set(APP_HEADER).send({ month, salonId: s.id, sent: 900 });
    await agent.put('/api/v1/infra/sms-usage').set(APP_HEADER).send({ month, salonId: s.id, sent: 1000 });
    await agent.put('/api/v1/infra/sms-usage').set(APP_HEADER).send({ month, sent: 300, costBani: 5000 });
    const usage = (await agent.get(`/api/v1/infra/sms-usage?month=${month}`)).body;
    expect(usage.items.map((u: AnyRow) => [u.salonName, u.sent, u.costBani])).toEqual([
      ['Barber House', 1000, 20000],
      [null, 300, 5000],
    ]);
    const sms = (await agent.get('/api/v1/infra/health')).body.sms;
    expect(sms).toMatchObject({ sent: 1300, budget: 1500, pct: 87, premiumSalons: 1, perSalonBudget: 1500 });
    expect((await agent.put('/api/v1/infra/sms-usage').set(APP_HEADER).send({ month: '2026-13', sent: 1 })).status).toBe(400);
  });

  it('logs backups and restore tests, and puts renewals in the calendar', async () => {
    const { agent } = await signedIn();
    expect((await agent.get('/api/v1/infra/health')).body.backups).toMatchObject({ lastBackupAt: null, lastRestoreTestDays: null });
    await agent.post('/api/v1/infra/backup-checks').set(APP_HEADER).send({ kind: 'backup', fileName: 'vinit-2026-11-07.dump' });
    await agent.post('/api/v1/infra/backup-checks').set(APP_HEADER).send({ kind: 'restore_test', note: 'Restored into vinit_test, all good', checkedAt: new Date(Date.now() - 40 * 86_400_000).toISOString() });
    const backups = (await agent.get('/api/v1/infra/health')).body.backups;
    expect(backups).toMatchObject({ lastBackupDays: 0, lastBackupFile: 'vinit-2026-11-07.dump', lastRestoreTestDays: 40 });
    expect((await agent.post('/api/v1/infra/backup-checks').set(APP_HEADER).send({ kind: 'backup', checkedAt: '2099-01-01T00:00:00Z' })).status).toBe(400);

    await agent.post('/api/v1/infra/services').set(APP_HEADER).send({ name: 'Figma', category: 'tooling', renewsOn: addDays(today(), 12) });
    const deadlines: AnyRow[] = (await agent.get('/api/v1/deadlines/upcoming?days=30')).body.items;
    expect(deadlines.map((d) => [d.title, d.category])).toEqual([['Figma renews', 'service_subscription']]);
    expect((await agent.get('/api/v1/infra/health')).body.renewing.map((r: AnyRow) => r.name)).toEqual(['Figma']);
  });
});
