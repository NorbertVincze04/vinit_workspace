import { describe, expect, it } from 'vitest';
import { APP_HEADER, AnyRow, signedIn } from './helpers.js';

const OLD = [
  { id: 'c1', salon: 'Lead Shop', owner: 'Ion', city: 'Iași', phone: '0711', email: 'ion@x.ro', domain: '', plan: 'standard', price: 150, status: 'lead', since: '2026-10-01', notes: 'Met at the fair' },
  { id: 'c2', salon: 'Demo Shop', owner: '', city: 'Cluj', phone: '', email: 'not-an-email', domain: '', plan: 'premium', price: 200, status: 'demo', since: '', notes: '' },
  { id: 'c3', salon: 'Beta Shop', owner: 'Ana', city: 'Satu Mare', phone: '0722', email: '', domain: 'https://BetaShop.ro/', plan: 'standard', price: 0, status: 'beta', since: '2026-09-15', notes: '' },
  { id: 'c4', salon: 'Paying Shop', owner: 'Dan', city: 'Pitești', phone: '', email: 'dan@shop.ro', domain: 'payingshop.ro', plan: 'premium', price: 199.99, status: 'active', since: '2026-08-01', notes: 'Pays on time' },
  { id: 'c5', salon: 'Paused Shop', owner: '', city: '', phone: '', email: '', domain: 'payingshop.ro', plan: 'standard', price: 150, status: 'paused', since: '2026-07-01', notes: '' },
];

describe('moving the old browser Clients', () => {
  it('turns leads into leads and customers into client + salon + subscription, once', async () => {
    const { agent } = await signedIn();
    const res = await agent.post('/api/v1/import/legacy-clients').set(APP_HEADER).send({ records: OLD });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ leads: 2, salons: 3, skipped: 0, needsAddress: 3 });
    expect(res.body.notes).toEqual(['Paused Shop: domain payingshop.ro is already used by another salon, not added']);

    const leads: AnyRow[] = (await agent.get('/api/v1/leads')).body.items;
    expect(leads.map((l) => [l.businessName, l.stage, l.interestedPlanName])).toEqual([
      ['Lead Shop', 'contacted', 'Standard Barbershop'],
      ['Demo Shop', 'demo_booked', 'Premium Brand'],
    ]);
    expect(leads[1].notes).toContain('Email (as typed): not-an-email');

    const salons: AnyRow[] = (await agent.get('/api/v1/salons')).body.items;
    const byName = Object.fromEntries(salons.map((s) => [s.name, s]));
    expect(byName['Beta Shop']).toMatchObject({ status: 'trial', subscriptionStatus: 'trialing', primaryDomain: 'betashop.ro', clientAddressMissing: true });
    expect(byName['Paying Shop']).toMatchObject({ status: 'active', subscriptionStatus: 'active', mrrBani: 19999, planCode: 'premium' });
    expect(byName['Paused Shop']).toMatchObject({ status: 'paused', subscriptionStatus: 'paused', primaryDomain: null });

    const subs: AnyRow[] = (await agent.get('/api/v1/subscriptions')).body.items;
    expect(subs.find((s) => s.salonName === 'Beta Shop')).toMatchObject({ promotionCode: 'beta', priceBani: 0, startedOn: '2026-09-15' });
    expect(subs.find((s) => s.salonName === 'Paying Shop')).toMatchObject({ startedOn: '2026-08-01' });

    const clients: AnyRow[] = (await agent.get('/api/v1/clients')).body.items;
    expect(clients.map((c) => c.businessAddress)).toEqual([null, null, null]);

    const again = await agent.post('/api/v1/import/legacy-clients').set(APP_HEADER).send({ records: OLD });
    expect(again.body).toMatchObject({ leads: 0, salons: 0, skipped: 5 });
  });
});
