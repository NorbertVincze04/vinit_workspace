import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { APP_HEADER, AnyRow, createSalon, makeUser, signedIn } from './helpers.js';

describe('activity feed', () => {
  it('needs a session', async () => {
    expect((await request(createApp()).get('/api/v1/activity')).status).toBe(401);
  });

  it('lists everything newest first, by area, person and salon, page by page', async () => {
    const { agent, user } = await signedIn();
    const s = await createSalon(agent, { name: 'Barber House' });
    await agent.post('/api/v1/leads').set(APP_HEADER).send({ businessName: 'Prospect' });
    await agent.post('/api/v1/tasks').set(APP_HEADER).send({ text: 'Register the SRL' });

    const all = (await agent.get('/api/v1/activity')).body;
    const types = all.items.map((a: AnyRow) => a.entityType);
    // The salon and its client are saved together (same timestamp), so their order is arbitrary.
    expect(types.slice(0, 2)).toEqual(['tasks', 'leads']);
    expect(types.slice(2).sort()).toEqual(['clients', 'salons']);
    expect(all.items[0]).toMatchObject({ userName: user.fullName, summary: 'Register the SRL' });
    expect(all.next).toBeNull();

    expect((await agent.get('/api/v1/activity?area=sales')).body.items.map((a: AnyRow) => a.entityType)).toEqual(['leads', 'clients']);
    expect((await agent.get(`/api/v1/activity?salonId=${s.id}`)).body.items).toMatchObject([{ entityType: 'salons', salonName: 'Barber House' }]);
    const other = await makeUser('other@vinit.test', 'Other Person');
    expect((await agent.get(`/api/v1/activity?userId=${other.id}`)).body.items).toEqual([]);

    // Pages: several entries share a timestamp (one save), the cursor still never repeats or skips.
    const first = (await agent.get('/api/v1/activity?limit=2')).body;
    expect(first.items).toHaveLength(2);
    const second = (await agent.get(`/api/v1/activity?limit=2&before=${encodeURIComponent(first.next)}`)).body;
    const ids = [...first.items, ...second.items].map((a: AnyRow) => a.id);
    expect(new Set(ids).size).toBe(4);
    expect(second.next).toBeNull();

    expect((await agent.get('/api/v1/activity?before=nonsense')).status).toBe(400);
  });
});
