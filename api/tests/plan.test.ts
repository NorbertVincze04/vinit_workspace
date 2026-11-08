import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/knex.js';
import { targetsFor, yearOfMonth, yearRange } from '../src/lib/targets.js';
import { APP_HEADER, AnyRow, signedIn } from './helpers.js';

type Agent = Awaited<ReturnType<typeof signedIn>>['agent'];
const years = async (agent: Agent): Promise<AnyRow> => (await agent.get('/api/v1/plan/years')).body;
const year = async (agent: Agent, n: number): Promise<AnyRow> => (await years(agent)).items.find((y: AnyRow) => y.year === n);

describe('year plans', () => {
  it('need a session', async () => {
    expect((await request(createApp()).get('/api/v1/plan/years')).status).toBe(401);
  });

  it('count plan years from the plan start', () => {
    expect(yearOfMonth('2026-12', '2026-11')).toBe(1);
    expect(yearOfMonth('2026-12', '2027-11')).toBe(1);
    expect(yearOfMonth('2026-12', '2027-12')).toBe(2);
    expect(yearRange('2026-12', 2)).toEqual({ from: '2027-12', to: '2028-11' });
  });

  it('start with Year 1: the business-plan goals and the roadmap as it was', async () => {
    const { agent } = await signedIn();
    const body = await years(agent);
    expect(body).toMatchObject({ start: '2026-12', currentYear: 1 });
    const y1 = body.items[0];
    expect(y1).toMatchObject({ year: 1, from: '2026-12', to: '2027-11', status: 'current' });
    expect(y1.goals).toEqual({
      payingSalons: 50,
      breakEvenSalons: 46,
      mrrBani: 750000,
      incomeBani: null,
      monthlyCostsBani: 686000,
      retentionPct: 70,
      onboardingHours: 48,
      smsMonthlyBudget: 1500,
      operationalCostsBani: 308000,
    });
    expect(y1.phases.map((p: AnyRow) => [p.key, p.name, p.monthFrom, p.monthTo, p.steps.length])).toEqual([
      ['build', 'Build', 1, 3, 6],
      ['prove', 'Prove', 4, 6, 6],
      ['sell', 'Sell', 7, 9, 5],
      ['scale', 'Scale', 10, 12, 5],
    ]);
    expect(y1.phases[0].steps[0]).toEqual({ id: 'b1', text: 'Finish the multi-tenant app and the JSON template for new salons', position: 0, done: false });
    expect(y1.phases[3].milestone).toBe('50 salons and 7.500 RON of monthly recurring income.');
  });

  it('set goals, and the dashboards use the current year’s', async () => {
    const { agent } = await signedIn();
    const res = await agent.patch('/api/v1/plan/years/1').set(APP_HEADER).send({ payingSalons: 60, incomeBani: 4_000_000, smsMonthlyBudget: null, notes: 'Stretch' });
    expect(res.status).toBe(200);
    expect(res.body.item.goals).toMatchObject({ payingSalons: 60, incomeBani: 4_000_000, smsMonthlyBudget: null });
    // Not set → the built-in figure.
    expect(res.body.item.effective).toMatchObject({ payingSalons: 60, smsMonthlyBudget: 1500 });
    expect(await targetsFor(db)).toMatchObject({ year: 1, payingSalons: 60, incomeBani: 4_000_000 });
    expect((await agent.get('/api/v1/kpis')).body.targets).toMatchObject({ payingSalons: 60 });

    expect((await agent.patch('/api/v1/plan/years/1').set(APP_HEADER).send({ retentionPct: 120 })).status).toBe(400);
    expect((await agent.patch('/api/v1/plan/years/1').set(APP_HEADER).send({ payingSalons: -1 })).status).toBe(400);
    expect((await agent.patch('/api/v1/plan/years/9').set(APP_HEADER).send({ payingSalons: 1 })).status).toBe(404);
  });

  it('add the next year: goals and phase outline copied, steps empty; edit its roadmap', async () => {
    const { agent } = await signedIn();
    const created = await agent.post('/api/v1/plan/years').set(APP_HEADER);
    expect(created.status).toBe(201);
    const y2 = created.body.item;
    expect(y2).toMatchObject({ year: 2, from: '2027-12', to: '2028-11', status: 'future', goals: { payingSalons: 50 } });
    expect(y2.phases.map((p: AnyRow) => [p.name, p.steps.length, p.milestone])).toEqual([
      ['Build', 0, ''],
      ['Prove', 0, ''],
      ['Sell', 0, ''],
      ['Scale', 0, ''],
    ]);

    // Year 2 goals: unset ones fall back to Year 1's.
    await agent.patch('/api/v1/plan/years/2').set(APP_HEADER).send({ payingSalons: 120, retentionPct: null });
    expect((await year(agent, 2)).effective).toMatchObject({ payingSalons: 120, retentionPct: 70 });

    // Phases and steps.
    const phase = y2.phases[0];
    expect((await agent.patch(`/api/v1/plan/phases/${phase.id}`).set(APP_HEADER).send({ name: 'Expand', monthFrom: 1, monthTo: 4, milestone: '100 salons' })).body.item).toMatchObject({ name: 'Expand', monthTo: 4 });
    expect((await agent.patch(`/api/v1/plan/phases/${phase.id}`).set(APP_HEADER).send({ monthFrom: 6 })).status).toBe(400);
    const added = await agent.post('/api/v1/plan/years/2/phases').set(APP_HEADER).send({ name: 'Bonus', monthFrom: 12, monthTo: 12 });
    expect(added.body.item).toMatchObject({ name: 'Bonus', position: 4, steps: [] });

    const step = (await agent.post(`/api/v1/plan/phases/${phase.id}/steps`).set(APP_HEADER).send({ text: 'Open in Bucharest' })).body.item;
    expect(step).toMatchObject({ text: 'Open in Bucharest', done: false });
    expect((await agent.post(`/api/v1/plan/phases/${phase.id}/steps`).set(APP_HEADER).send({ text: '  ' })).status).toBe(400);
    await agent.put(`/api/v1/roadmap/steps/${step.id}`).set(APP_HEADER).send({ done: true });
    expect((await year(agent, 2)).phases[0].steps).toEqual([{ id: step.id, text: 'Open in Bucharest', position: 0, done: true }]);
    await agent.patch(`/api/v1/plan/steps/${step.id}`).set(APP_HEADER).send({ text: 'Open in Bucharest and Iași' });
    expect((await agent.delete(`/api/v1/plan/steps/${step.id}`).set(APP_HEADER)).status).toBe(204);
    expect(await db('roadmapProgress').where({ stepId: step.id }).first()).toBeUndefined();
    expect((await agent.delete(`/api/v1/plan/phases/${added.body.item.id}`).set(APP_HEADER)).status).toBe(204);

    // Year 1 is untouched by all of that.
    expect((await year(agent, 1)).phases.map((p: AnyRow) => p.steps.length)).toEqual([6, 6, 5, 5]);

    // Only the last year, and only before it starts, can be removed.
    expect((await agent.delete('/api/v1/plan/years/1').set(APP_HEADER)).status).toBe(409);
    expect((await agent.delete('/api/v1/plan/years/2').set(APP_HEADER)).status).toBe(204);
    expect((await years(agent)).items.map((y: AnyRow) => y.year)).toEqual([1]);
  });

  it('show how a past year went', async () => {
    const { agent } = await signedIn();
    // Plan started two years ago: Year 1 = Dec 2024 – Nov 2025 is over.
    await agent.put('/api/v1/settings/plan.start').set(APP_HEADER).send({ value: '2024-12' });
    await agent.post('/api/v1/plan/years').set(APP_HEADER);
    await db('finTransactions').insert([
      { type: 'income', amountBani: 300_000, currency: 'RON', date: '2025-03-10', scope: 'business' },
      { type: 'income', amountBani: 10_000, currency: 'EUR', date: '2025-06-01', scope: 'business' },
      { type: 'income', amountBani: 999_999, currency: 'RON', date: '2025-06-01', scope: 'personal' },
      { type: 'expense', amountBani: 1_200_000, currency: 'RON', date: '2025-01-15', scope: 'business' },
      { type: 'income', amountBani: 50_000, currency: 'RON', date: '2025-12-02', scope: 'business' },
    ]);
    await agent.put('/api/v1/roadmap/steps/b1').set(APP_HEADER).send({ done: true });
    await agent.put('/api/v1/roadmap/steps/b2').set(APP_HEADER).send({ done: true });

    const all = await years(agent);
    expect(all.currentYear).toBe(2);
    expect(all.items.map((y: AnyRow) => y.status)).toEqual(['past', 'current']);

    const r = (await agent.get('/api/v1/plan/years/1/results')).body;
    expect(r).toMatchObject({ year: 1, from: '2024-12', to: '2025-11', months: 12, steps: { done: 2, total: 22 } });
    // 3.000 RON + 100 EUR (× 5 default rate); personal money and Year 2 don't count.
    expect(r.actual).toMatchObject({ incomeBani: 350_000, monthlyCostsBani: 100_000, payingSalons: 0, smsMonthlyMax: 0 });
    expect((await agent.get('/api/v1/plan/years/2/results')).body.actual.incomeBani).toBe(50_000);
    expect((await agent.get('/api/v1/plan/years/7/results')).status).toBe(404);
  });
});
