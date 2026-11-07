import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { words } from '../src/modules/search/search.routes.js';
import { APP_HEADER, AnyRow, createSalon, signedIn } from './helpers.js';

const search = async (agent: Awaited<ReturnType<typeof signedIn>>['agent'], q: string): Promise<AnyRow[]> =>
  (await agent.get(`/api/v1/search?q=${encodeURIComponent(q)}`)).body.items;

describe('global search', () => {
  it('needs a session', async () => {
    expect((await request(createApp()).get('/api/v1/search?q=x')).status).toBe(401);
  });

  it('splits words, drops diacritics and LIKE wildcards', () => {
    expect(words('  Ștefan  cel%_mare ')).toEqual(['stefan', 'celmare']);
  });

  it('finds salons (also by who pays), leads, tickets, contracts, feature requests and wiki pages', async () => {
    const { agent } = await signedIn();
    const s = await createSalon(agent, { name: 'Frizeria Bărbaților', city: 'Timișoara', domain: 'barbati.ro' }, { name: 'Bărbați SRL', phone: '0744 123 456' });
    await agent.post('/api/v1/leads').set(APP_HEADER).send({ businessName: 'Barber Timisoara', city: 'Timișoara' });
    const t = (await agent.post('/api/v1/tickets').set(APP_HEADER).send({ salonId: s.id, title: 'Programări lipsă' })).body.item;
    await agent.post('/api/v1/contracts').set(APP_HEADER).send({ salonId: s.id, kind: 'dpa', number: 'VIN-2026-042' });
    await agent.post('/api/v1/feature-requests').set(APP_HEADER).send({ title: 'Barbati loyalty card' });

    const hits = await search(agent, 'barbati');
    expect(hits.map((h) => h.type)).toEqual(expect.arrayContaining(['salon', 'feature', 'contract']));
    expect(hits.find((h) => h.type === 'salon')).toMatchObject({ title: 'Frizeria Bărbaților', link: `/tools/salons/${s.id}`, sub: expect.stringContaining('barbati.ro') });

    // Every word has to match: city + name.
    expect((await search(agent, 'timisoara barber')).map((h) => h.title)).toEqual(['Barber Timisoara']);
    expect((await search(agent, 'programari')).map((h) => h.type)).toEqual(['ticket']);
    expect((await search(agent, `T-${t.number}`))[0]).toMatchObject({ type: 'ticket', link: `/tools/salons/${s.id}?tab=support` });
    expect((await search(agent, '0744'))[0]).toMatchObject({ type: 'salon', title: 'Frizeria Bărbaților', sub: expect.stringContaining('Bărbați SRL') });
    expect((await search(agent, 'backup'))[0]).toMatchObject({ type: 'wiki', link: '/tools/wiki/backups-and-restore' });
    expect(await search(agent, '  ')).toEqual([]);
    expect(await search(agent, '%')).toEqual([]);
  });
});
