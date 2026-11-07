import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prefixQuery, slugify } from '../src/modules/wiki/wiki.routes.js';
import { APP_HEADER, AnyRow, signedIn } from './helpers.js';

describe('wiki', () => {
  it('needs a session', async () => {
    expect((await request(createApp()).get('/api/v1/wiki')).status).toBe(401);
  });

  it('makes slugs and search queries from any text', () => {
    expect(slugify('Fișă de onboarding: pașii!')).toBe('fisa-de-onboarding-pasii');
    expect(slugify('???')).toBe('page');
    expect(prefixQuery('Fișă  onboard')).toBe('fisa:* & onboard:*');
    expect(prefixQuery(' & | ! ')).toBeNull();
  });

  it('comes with starter pages and finds words without diacritics', async () => {
    const { agent } = await signedIn();
    const all: AnyRow[] = (await agent.get('/api/v1/wiki')).body.items;
    expect(all.map((p) => p.slug)).toEqual(['backups-and-restore', 'onboarding-in-48h', 'plans-prices-and-offers']);

    await agent.post('/api/v1/wiki').set(APP_HEADER).send({ title: 'Fișă pentru frizerii', category: 'sales', bodyMd: 'Trimite fișa înainte de demo.' });
    const found: AnyRow[] = (await agent.get('/api/v1/wiki?q=fisa')).body.items;
    expect(found.map((p) => p.slug)).toEqual(['fisa-pentru-frizerii']);
    expect(found[0].headline).toContain('«');

    const prefix: AnyRow[] = (await agent.get('/api/v1/wiki?q=backu')).body.items;
    expect(prefix[0].slug).toBe('backups-and-restore');
    expect((await agent.get('/api/v1/wiki?q=onboarding&category=sales')).body.items).toEqual([]);
  });

  it('keeps every version, refuses a stale save, and restores old text', async () => {
    const { agent, user } = await signedIn();
    const page = (await agent.post('/api/v1/wiki').set(APP_HEADER).send({ title: 'Deploy a salon', bodyMd: 'v1' })).body.item;
    expect(page).toMatchObject({ slug: 'deploy-a-salon', revision: 1, category: 'other' });
    const same = (await agent.post('/api/v1/wiki').set(APP_HEADER).send({ title: 'Deploy a salon' })).body.item;
    expect(same.slug).toBe('deploy-a-salon-2');

    const v2 = await agent.put('/api/v1/wiki/deploy-a-salon').set(APP_HEADER).send({ bodyMd: 'v2', baseRevision: 1 });
    expect(v2.body.item).toMatchObject({ revision: 2, bodyMd: 'v2', updatedByName: user.fullName });
    const stale = await agent.put('/api/v1/wiki/deploy-a-salon').set(APP_HEADER).send({ bodyMd: 'mine', baseRevision: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('edit_conflict');
    // Saving the same content adds no version.
    expect((await agent.put('/api/v1/wiki/deploy-a-salon').set(APP_HEADER).send({ bodyMd: 'v2' })).body.item.revision).toBe(2);

    const restored = await agent.post('/api/v1/wiki/deploy-a-salon/restore/1').set(APP_HEADER);
    expect(restored.body.item).toMatchObject({ revision: 3, bodyMd: 'v1' });
    const history: AnyRow[] = (await agent.get('/api/v1/wiki/deploy-a-salon/revisions')).body.items;
    expect(history.map((r) => [r.revision, r.bodyMd])).toEqual([
      [3, 'v1'],
      [2, 'v2'],
      [1, 'v1'],
    ]);
  });

  it('archives instead of deleting', async () => {
    const { agent } = await signedIn();
    await agent.post('/api/v1/wiki/backups-and-restore/archive').set(APP_HEADER).send({ archived: true });
    expect((await agent.get('/api/v1/wiki')).body.items.map((p: AnyRow) => p.slug)).not.toContain('backups-and-restore');
    expect((await agent.get('/api/v1/wiki?archived=true')).body.items.map((p: AnyRow) => p.slug)).toEqual(['backups-and-restore']);
    expect((await agent.get('/api/v1/wiki/nope')).status).toBe(404);
    expect((await agent.get('/api/v1/wiki/Bad Slug')).status).toBe(400);
  });
});
