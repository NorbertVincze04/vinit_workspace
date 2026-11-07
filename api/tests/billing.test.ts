import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { addDays, addMonths, today } from '../src/lib/dates.js';
import { APP_HEADER, Agent, AnyRow, createSalon, planId, promotionId, signedIn } from './helpers.js';

async function subscribe(agent: Agent, salonId: string, body: AnyRow): Promise<AnyRow> {
  const res = await agent.post(`/api/v1/salons/${salonId}/subscriptions`).set(APP_HEADER).send(body);
  if (res.status !== 201) throw new Error(`subscribe failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.item;
}

const change = (agent: Agent, id: string, body: AnyRow) => agent.post(`/api/v1/subscriptions/${id}/change`).set(APP_HEADER).send(body);
const salon = async (agent: Agent, id: string): Promise<AnyRow> => (await agent.get(`/api/v1/salons/${id}`)).body.item;

describe('billing endpoints need a session', () => {
  it.each(['/subscriptions', '/subscriptions/warnings', '/payments', '/metrics/mrr'])('GET %s → 401', async (path) => {
    expect((await request(createApp()).get(`/api/v1${path}`)).status).toBe(401);
  });
});

describe('subscriptions', () => {
  it('starts an Early Bird trial: 3 free months, salon in trial, no MRR yet', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent, { status: 'lead' });
    const sub = await subscribe(agent, s.id, {
      planId: await planId(agent, 'standard'),
      promotionId: await promotionId(agent, 'early_bird'),
      startedOn: '2026-11-07',
    });
    expect(sub).toMatchObject({ status: 'trialing', priceBani: 15000, trialEndsOn: '2027-02-06', promotionCode: 'early_bird', mrrBani: 0 });

    const row = await salon(agent, s.id);
    expect(row).toMatchObject({ status: 'trial', planCode: 'standard', subscriptionStatus: 'trialing', mrrBani: 0, trialEndsOn: '2027-02-06' });

    const promos: AnyRow[] = (await agent.get('/api/v1/promotions')).body.items;
    expect(promos.find((p) => p.code === 'early_bird')?.used).toBe(1);

    const again = await agent.post(`/api/v1/salons/${s.id}/subscriptions`).set(APP_HEADER).send({ planId: await planId(agent, 'premium') });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('has_subscription');
  });

  it('refuses a promotion once its places are taken; beta salons do not use Early Bird places', async () => {
    const { agent } = await signedIn();
    const earlyBird = await promotionId(agent, 'early_bird');
    await agent.patch(`/api/v1/promotions/${earlyBird}`).set(APP_HEADER).send({ maxSalons: 1 });
    const standard = await planId(agent, 'standard');

    const a = await createSalon(agent, { name: 'A' });
    const b = await createSalon(agent, { name: 'B' });
    const c = await createSalon(agent, { name: 'C' });
    await subscribe(agent, a.id, { planId: standard, promotionId: earlyBird });
    const full = await agent.post(`/api/v1/salons/${b.id}/subscriptions`).set(APP_HEADER).send({ planId: standard, promotionId: earlyBird });
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('promotion_full');

    const beta = await subscribe(agent, c.id, { planId: standard, promotionId: await promotionId(agent, 'beta') });
    expect(beta).toMatchObject({ status: 'trialing', promotionCode: 'beta', priceBani: 0, trialEndsOn: null });
  });

  it('follows the subscription through conversion, upgrade, pause, resume and cancel', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent);
    const sub = await subscribe(agent, s.id, { planId: await planId(agent, 'standard'), trialEndsOn: addDays(today(), 30) });
    expect(sub.status).toBe('trialing');

    let res = await change(agent, sub.id, { kind: 'trial_converted' });
    expect(res.body.item).toMatchObject({ status: 'active', mrrBani: 15000 });
    expect((await salon(agent, s.id)).status).toBe('active');

    res = await change(agent, sub.id, { kind: 'upgrade', planId: await planId(agent, 'premium') });
    expect(res.body.item).toMatchObject({ planCode: 'premium', priceBani: 20000, mrrBani: 20000 });
    expect((await salon(agent, s.id)).planCode).toBe('premium');

    res = await change(agent, sub.id, { kind: 'pause', note: 'Renovation' });
    expect(res.body.item).toMatchObject({ status: 'paused', mrrBani: 0 });
    expect((await salon(agent, s.id)).status).toBe('paused');

    expect((await change(agent, sub.id, { kind: 'trial_converted' })).status).toBe(409);
    res = await change(agent, sub.id, { kind: 'resume' });
    expect(res.body.item.status).toBe('active');

    expect((await change(agent, sub.id, { kind: 'cancel' })).status).toBe(400);
    res = await change(agent, sub.id, { kind: 'cancel', note: 'Moved to another app' });
    expect(res.body.item).toMatchObject({ status: 'canceled', cancelReason: 'Moved to another app' });
    expect(await salon(agent, s.id)).toMatchObject({ status: 'churned', churnReason: 'Moved to another app', subscriptionStatus: null });

    const billing = (await agent.get(`/api/v1/salons/${s.id}/overview`)).body.billing;
    expect(billing.subscription.status).toBe('canceled');
    expect(billing.changes.map((c: AnyRow) => c.kind)).toEqual(['cancel', 'resume', 'pause', 'upgrade', 'trial_converted', 'start']);
  });

  it('sets the minimum term for Custom and bills a one-off project once', async () => {
    const { agent } = await signedIn();
    const custom = await planId(agent, 'custom');
    const a = await createSalon(agent, { name: 'Monthly custom' });
    const monthly = await subscribe(agent, a.id, { planId: custom, priceBani: 120000, startedOn: '2026-11-07' });
    expect(monthly).toMatchObject({ status: 'active', minTermEndsOn: '2027-03-06', mrrBani: 120000 });

    const b = await createSalon(agent, { name: 'One-off' });
    const oneOff = await subscribe(agent, b.id, { planId: custom, billingCycle: 'one_off', startedOn: '2026-11-07' });
    expect(oneOff).toMatchObject({ priceBani: 100000, mrrBani: 0 });
    const payments: AnyRow[] = (await agent.get(`/api/v1/payments?salonId=${b.id}`)).body.items;
    expect(payments).toMatchObject([{ kind: 'one_off', amountBani: 100000, dueOn: '2026-11-07', status: 'due' }]);
  });

  it('rebuilds MRR month by month from the changes', async () => {
    const { agent } = await signedIn();
    const standard = await planId(agent, 'standard');
    const a = await createSalon(agent, { name: 'A' });
    const b = await createSalon(agent, { name: 'B' });
    const subA = await subscribe(agent, a.id, { planId: standard, startedOn: '2026-01-15' });
    await subscribe(agent, b.id, { planId: standard, billingCycle: 'quarterly', startedOn: '2026-02-01' });
    await change(agent, subA.id, { kind: 'price_change', priceBani: 12000, on: '2026-03-10' });
    await change(agent, subA.id, { kind: 'cancel', note: 'Closed', on: '2026-04-20' });

    const mrr = (await agent.get('/api/v1/metrics/mrr?from=2025-12&to=2026-04')).body.items;
    expect(mrr).toEqual([
      { month: '2025-12', mrrBani: 0, paying: 0 },
      { month: '2026-01', mrrBani: 15000, paying: 1 },
      { month: '2026-02', mrrBani: 30000, paying: 2 },
      { month: '2026-03', mrrBani: 27000, paying: 2 },
      { month: '2026-04', mrrBani: 15000, paying: 1 },
    ]);
  });
});

describe('payments', () => {
  it('generates each month once, on the billing day after the trial', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent);
    const sub = await subscribe(agent, s.id, { planId: await planId(agent, 'standard'), startedOn: '2026-01-15', trialEndsOn: '2026-01-31' });
    await change(agent, sub.id, { kind: 'trial_converted', on: '2026-02-01' });
    const q = await createSalon(agent, { name: 'Quarterly' });
    await subscribe(agent, q.id, { planId: await planId(agent, 'standard'), billingCycle: 'quarterly', startedOn: '2026-01-10' });

    const gen = (month: string) => agent.post('/api/v1/payments/generate').set(APP_HEADER).send({ month });
    expect((await gen('2026-03')).body.created).toBe(1);
    expect((await gen('2026-03')).body.created).toBe(0);
    expect((await gen('2026-04')).body.created).toBe(2);
    expect((await agent.post('/api/v1/payments/generate').set(APP_HEADER).send({ month: '2026-13' })).status).toBe(400);

    const list: AnyRow[] = (await agent.get(`/api/v1/payments?salonId=${s.id}`)).body.items;
    expect(list.map((p) => [p.periodStart, p.periodEnd, p.amountBani])).toEqual([
      ['2026-04-01', '2026-04-30', 15000],
      ['2026-03-01', '2026-03-31', 15000],
    ]);
    const quarterly: AnyRow[] = (await agent.get(`/api/v1/payments?salonId=${q.id}`)).body.items;
    expect(quarterly.map((p) => [p.periodStart, p.periodEnd, p.amountBani])).toEqual([['2026-04-10', '2026-07-09', 45000]]);
  });

  it('marks a payment paid, adds the income to Finances, and can undo it', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent, { name: 'Barber House' });
    const created = await agent
      .post('/api/v1/payments')
      .set(APP_HEADER)
      .send({ salonId: s.id, kind: 'extra_work', amountBani: 15050, dueOn: '2026-11-01' });
    expect(created.status).toBe(201);
    expect(created.body.item.overdue).toBe(today() > '2026-11-01');
    const id = created.body.item.id;

    const paid = await agent.post(`/api/v1/payments/${id}/mark-paid`).set(APP_HEADER).send({ paidOn: '2026-11-05', invoiceNumber: 'VIN-001' });
    expect(paid.body.item).toMatchObject({ status: 'paid', paidOn: '2026-11-05', invoiceNumber: 'VIN-001', overdue: false });
    const tx: AnyRow[] = (await agent.get('/api/v1/finances/transactions')).body.items;
    expect(tx).toMatchObject([
      { type: 'income', amountBani: 15050, date: '2026-11-05', category: 'Extra work', scope: 'business', reference: 'VIN-001', paymentId: id },
    ]);

    expect((await agent.post(`/api/v1/payments/${id}/mark-paid`).set(APP_HEADER).send({})).status).toBe(409);
    expect((await agent.delete(`/api/v1/payments/${id}`).set(APP_HEADER)).status).toBe(409);

    const reopened = await agent.post(`/api/v1/payments/${id}/reopen`).set(APP_HEADER);
    expect(reopened.body.item).toMatchObject({ status: 'due', paidOn: null, transactionId: null });
    expect((await agent.get('/api/v1/finances/transactions')).body.items).toEqual([]);

    await agent.post(`/api/v1/payments/${id}/mark-paid`).set(APP_HEADER).send({ createTransaction: false });
    expect((await agent.get('/api/v1/finances/transactions')).body.items).toEqual([]);
  });

  it('rejects money in RON decimals and payments for another salon’s subscription', async () => {
    const { agent } = await signedIn();
    const a = await createSalon(agent, { name: 'A' });
    const b = await createSalon(agent, { name: 'B' });
    const sub = await subscribe(agent, a.id, { planId: await planId(agent, 'standard') });
    expect((await agent.post('/api/v1/payments').set(APP_HEADER).send({ salonId: a.id, amountBani: 150.5, dueOn: '2026-11-01' })).status).toBe(400);
    const wrong = await agent.post('/api/v1/payments').set(APP_HEADER).send({ salonId: b.id, subscriptionId: sub.id, amountBani: 100, dueOn: '2026-11-01' });
    expect(wrong.status).toBe(400);
  });
});

describe('warnings', () => {
  it('lists late payments, trials ending, salons without a subscription; paying clears past due', async () => {
    const { agent } = await signedIn();
    const standard = await planId(agent, 'standard');
    const late = await createSalon(agent, { name: 'Late payer' });
    const sub = await subscribe(agent, late.id, { planId: standard, startedOn: addMonths(today(), -2) });
    await change(agent, sub.id, { kind: 'past_due' });
    const pay = await agent
      .post('/api/v1/payments')
      .set(APP_HEADER)
      .send({ salonId: late.id, subscriptionId: sub.id, amountBani: 15000, dueOn: addDays(today(), -5) });

    const trial = await createSalon(agent, { name: 'Trial ending' });
    await subscribe(agent, trial.id, { planId: standard, trialEndsOn: addDays(today(), 3) });
    await createSalon(agent, { name: 'No sub', status: 'active' });

    const kinds = (await agent.get('/api/v1/subscriptions/warnings')).body.items.map((w: AnyRow) => `${w.kind}:${w.salonName}`);
    expect(kinds).toEqual(
      expect.arrayContaining(['payment_overdue:Late payer', 'past_due:Late payer', 'trial_ending:Trial ending', 'no_subscription:No sub']),
    );

    await agent.post(`/api/v1/payments/${pay.body.item.id}/mark-paid`).set(APP_HEADER).send({});
    expect((await agent.get(`/api/v1/subscriptions/${sub.id}`)).body.item.status).toBe('active');
    const after = (await agent.get('/api/v1/subscriptions/warnings')).body.items.map((w: AnyRow) => w.kind);
    expect(after).not.toContain('past_due');
    expect(after).not.toContain('payment_overdue');
  });
});
