import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/knex.js';
import { APP_HEADER, signedIn } from './helpers.js';

describe('protected tool endpoints', () => {
  it.each(['/tasks', '/goals', '/finances/transactions', '/marketing/posts', '/roadmap', '/settings', '/files'])(
    'GET %s needs a session',
    async (path) => {
      expect((await request(createApp()).get(`/api/v1${path}`)).status).toBe(401);
    },
  );
});

describe('tasks and goals', () => {
  it('creates, lists, updates and deletes a task, keeping the client id', async () => {
    const { agent } = await signedIn();
    const created = await agent
      .post('/api/v1/tasks')
      .set(APP_HEADER)
      .send({ id: 'tlx3k9a2f1q', text: 'Register the SRL', dueMonth: 2, phase: 'build', owner: 'Founder' });
    expect(created.status).toBe(201);
    expect(created.body.item).toMatchObject({ id: 'tlx3k9a2f1q', text: 'Register the SRL', prio: 'Medium', done: false, position: 0 });

    const second = await agent.post('/api/v1/tasks').set(APP_HEADER).send({ text: 'Second' });
    expect(second.body.item.position).toBe(1);

    const patched = await agent.patch('/api/v1/tasks/tlx3k9a2f1q').set(APP_HEADER).send({ done: true });
    expect(patched.status).toBe(200);
    expect(patched.body.item.done).toBe(true);

    const list = await agent.get('/api/v1/tasks');
    expect(list.body.items.map((t: { id: string }) => t.id)).toEqual(['tlx3k9a2f1q', second.body.item.id]);

    expect((await agent.delete('/api/v1/tasks/tlx3k9a2f1q').set(APP_HEADER)).status).toBe(204);
    expect((await agent.delete('/api/v1/tasks/tlx3k9a2f1q').set(APP_HEADER)).status).toBe(404);
  });

  it('rejects invalid values and unknown fields with field messages', async () => {
    const { agent } = await signedIn();
    const res = await agent.post('/api/v1/tasks').set(APP_HEADER).send({ dueMonth: 13, phase: 'later', colour: 'red' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation');
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['dueMonth', 'phase']));
  });

  it('unlinks tasks when their goal is deleted', async () => {
    const { agent } = await signedIn();
    await agent.post('/api/v1/goals').set(APP_HEADER).send({ id: 'g1', name: 'G1 – MVP' });
    await agent.post('/api/v1/tasks').set(APP_HEADER).send({ id: 't1', goalId: 'g1' });
    await agent.delete('/api/v1/goals/g1').set(APP_HEADER);
    const task = (await agent.get('/api/v1/tasks')).body.items[0];
    expect(task.goalId).toBeNull();
  });

  it('refuses a link to a goal that does not exist', async () => {
    const { agent } = await signedIn();
    const res = await agent.post('/api/v1/tasks').set(APP_HEADER).send({ goalId: 'nope' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('invalid_reference');
  });

  it('replaces everything from a backup, keeping order and dropping dead links', async () => {
    const { agent } = await signedIn();
    await agent.post('/api/v1/tasks').set(APP_HEADER).send({ text: 'old task' });
    await agent.put('/api/v1/goals').set(APP_HEADER).send({ items: [{ id: 'g1', name: 'Goal one' }] });
    const res = await agent
      .put('/api/v1/tasks')
      .set(APP_HEADER)
      .send({
        items: [
          { id: 'b', text: 'B', goalId: 'g1' },
          { id: 'a', text: 'A', goalId: 'deleted-goal', createdAt: '2026-01-02T10:00:00.000Z' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.items.map((t: { id: string }) => t.id)).toEqual(['b', 'a']);
    expect(res.body.items[0].goalId).toBe('g1');
    expect(res.body.items[1].goalId).toBeNull();
    expect(res.body.items[1].createdAt).toBe('2026-01-02T10:00:00.000Z');
  });

  it('rejects a backup with duplicate ids and leaves the data untouched', async () => {
    const { agent } = await signedIn();
    await agent.post('/api/v1/tasks').set(APP_HEADER).send({ id: 'keep', text: 'keep me' });
    const res = await agent.put('/api/v1/tasks').set(APP_HEADER).send({ items: [{ id: 'x' }, { id: 'x' }] });
    expect(res.status).toBe(400);
    expect((await agent.get('/api/v1/tasks')).body.items).toHaveLength(1);
  });

  it('records changes in the activity log', async () => {
    const { agent, user } = await signedIn();
    await agent.post('/api/v1/goals').set(APP_HEADER).send({ name: 'Break-even' });
    const log = await db('activity_log').where({ entityType: 'goals' });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ action: 'created', summary: 'Break-even', userId: user.id });
  });
});

describe('finances', () => {
  it('stores money as whole bani and refuses fractions', async () => {
    const { agent } = await signedIn();
    const ok = await agent
      .post('/api/v1/finances/transactions')
      .set(APP_HEADER)
      .send({ type: 'income', description: 'Salon Luxe – November', amountBani: 15000, date: '2026-11-05', scope: 'business' });
    expect(ok.status).toBe(201);
    expect(ok.body.item).toMatchObject({ amountBani: 15000, date: '2026-11-05', currency: 'RON', accountId: null });

    const fraction = await agent.post('/api/v1/finances/transactions').set(APP_HEADER).send({ amountBani: 150.5 });
    expect(fraction.status).toBe(400);
    expect(fraction.body.error.fields.amountBani).toBeDefined();
  });

  it('rejects impossible dates', async () => {
    const { agent } = await signedIn();
    const res = await agent.post('/api/v1/finances/transactions').set(APP_HEADER).send({ date: '2026-02-30' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.date).toBe('This date does not exist.');
  });

  it('allows a negative balance on an account (money owed)', async () => {
    const { agent } = await signedIn();
    const res = await agent.post('/api/v1/finances/accounts').set(APP_HEADER).send({ name: 'Card', kind: 'card', balanceBani: -125099 });
    expect(res.status).toBe(201);
    expect(res.body.item.balanceBani).toBe(-125099);
  });

  it('keeps transactions when their account is deleted', async () => {
    const { agent } = await signedIn();
    await agent.post('/api/v1/finances/accounts').set(APP_HEADER).send({ id: 'ac1', name: 'BT' });
    await agent.post('/api/v1/finances/transactions').set(APP_HEADER).send({ id: 'tx1', accountId: 'ac1', amountBani: 100 });
    await agent.delete('/api/v1/finances/accounts/ac1').set(APP_HEADER);
    const [tx] = (await agent.get('/api/v1/finances/transactions')).body.items;
    expect(tx).toMatchObject({ id: 'tx1', accountId: null, amountBani: 100 });
  });
});

describe('marketing', () => {
  it('stores platforms as a list', async () => {
    const { agent } = await signedIn();
    const res = await agent
      .post('/api/v1/marketing/posts')
      .set(APP_HEADER)
      .send({ title: 'Early Bird launch', month: 2, platforms: ['Instagram', 'TikTok'], budgetBani: 50000 });
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ platforms: ['Instagram', 'TikTok'], status: 'planned', week: 0, budgetBani: 50000 });
  });
});

describe('settings', () => {
  it('saves known settings and validates them', async () => {
    const { agent } = await signedIn();
    expect((await agent.put('/api/v1/settings/plan.start').set(APP_HEADER).send({ value: '2026-12' })).status).toBe(200);
    expect((await agent.put('/api/v1/settings/plan.start').set(APP_HEADER).send({ value: '2026-13' })).status).toBe(400);
    expect((await agent.put('/api/v1/settings/finances.rates').set(APP_HEADER).send({ value: { eur: 4.97, usd: 4.6 } })).status).toBe(200);
    expect((await agent.put('/api/v1/settings/whatever').set(APP_HEADER).send({ value: 1 })).status).toBe(404);
    const res = await agent.get('/api/v1/settings');
    expect(res.body.values).toEqual({ 'plan.start': '2026-12', 'finances.rates': { eur: 4.97, usd: 4.6 } });
  });
});

describe('roadmap', () => {
  it('ticks steps and imports a backup', async () => {
    const { agent } = await signedIn();
    expect((await agent.get('/api/v1/roadmap')).body).toEqual({ done: {}, salons: 0 });
    await agent.put('/api/v1/roadmap/steps/b1').set(APP_HEADER).send({ done: true });
    await agent.put('/api/v1/roadmap/steps/b2').set(APP_HEADER).send({ done: true });
    const afterUntick = await agent.put('/api/v1/roadmap/steps/b1').set(APP_HEADER).send({ done: false });
    expect(afterUntick.body.done).toEqual({ b2: true });

    const imported = await agent.put('/api/v1/roadmap').set(APP_HEADER).send({ done: { p1: true, p2: false }, salons: 7 });
    expect(imported.body).toEqual({ done: { p1: true }, salons: 7 });
    expect((await agent.put('/api/v1/roadmap').set(APP_HEADER).send({ done: {}, salons: 999 })).status).toBe(400);
  });
});

describe('files', () => {
  it('uploads, lists, downloads and deletes a file with a Romanian name', async () => {
    const { agent } = await signedIn();
    const bytes = Buffer.from('%PDF-1.4 fake pdf for tests');
    const up = await agent
      .post('/api/v1/files')
      .set(APP_HEADER)
      .field('name', 'Fișă onboarding (A4).pdf')
      .attach('file', bytes, { filename: 'onboarding.pdf', contentType: 'application/pdf' });
    expect(up.status).toBe(201);
    expect(up.body.item).toMatchObject({ name: 'Fișă onboarding (A4).pdf', kind: 'pdf', sizeBytes: bytes.length });

    const list = await agent.get('/api/v1/files');
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].bytes).toBeUndefined();

    const down = await agent.get(`/api/v1/files/${up.body.item.id}/download`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(down.status).toBe(200);
    expect(Buffer.compare(down.body as Buffer, bytes)).toBe(0);
    expect(down.headers['content-disposition']).toContain("filename*=UTF-8''Fi%C8%99%C4%83%20onboarding%20(A4).pdf");

    expect((await agent.delete(`/api/v1/files/${up.body.item.id}`).set(APP_HEADER)).status).toBe(204);
    expect(await db('file_blobs').count({ n: '*' }).first()).toEqual({ n: 0 });
  });

  it('rejects an upload without a file', async () => {
    const { agent } = await signedIn();
    const res = await agent.post('/api/v1/files').set(APP_HEADER).field('name', 'x.pdf');
    expect(res.status).toBe(400);
  });
});
