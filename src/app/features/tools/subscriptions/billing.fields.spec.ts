import { Plan, Promotion } from '../salons/salons.model';
import { changeBody, newSubscriptionBody, suggestedPrice } from './billing.fields';

const plan = (p: Partial<Plan>): Plan => ({
  id: 'p',
  code: 'standard',
  name: 'Standard',
  monthlyPrice: 150,
  oneOffFrom: 0,
  includedSessions: 2,
  sessionMinutes: 30,
  includesSms: false,
  minTermMonths: 0,
  extraHourly: 100,
  isActive: true,
  ...p,
});
const promo = (p: Partial<Promotion>): Promotion => ({
  id: 'x',
  code: 'x',
  name: 'X',
  freeMonths: null,
  discountPct: null,
  maxSalons: null,
  used: 0,
  isActive: true,
  notes: '',
  ...p,
});

describe('subscription form', () => {
  it('suggests the price per billing period, with discounts', () => {
    expect(suggestedPrice(plan({}), 'monthly', undefined)).toBe(150);
    expect(suggestedPrice(plan({}), 'quarterly', undefined)).toBe(450);
    expect(suggestedPrice(plan({ monthlyPrice: 200 }), 'yearly', undefined)).toBe(2400);
    expect(suggestedPrice(plan({ code: 'custom', monthlyPrice: 0, oneOffFrom: 1000 }), 'one_off', undefined)).toBe(1000);
    expect(suggestedPrice(plan({}), 'monthly', promo({ discountPct: 50 }))).toBe(75);
    // Free months don't change the price: they delay the first payment.
    expect(suggestedPrice(plan({}), 'monthly', promo({ freeMonths: 3 }))).toBe(150);
  });

  it('sends money in bani and lets the server pick the status when "Automatic"', () => {
    const body = newSubscriptionBody({ planId: 'p', billingCycle: 'monthly', promotionId: '', price: 149.99, startedOn: '2026-11-07', status: 'auto' });
    expect(body).toEqual(jasmine.objectContaining({ planId: 'p', promotionId: null, priceBani: 14999, startedOn: '2026-11-07' }));
    expect(body['status']).toBeUndefined();
    expect(body['trialEndsOn']).toBeUndefined();
    expect(newSubscriptionBody({ planId: 'p', price: 0, status: 'trialing' })['status']).toBe('trialing');
  });

  it('builds change requests', () => {
    expect(changeBody('upgrade', { planId: 'q', price: 200, on: '2026-12-01', note: '' })).toEqual({
      kind: 'upgrade',
      on: '2026-12-01',
      note: '',
      planId: 'q',
      priceBani: 20000,
    });
    expect(changeBody('pause', { on: '', note: 'Holiday' })).toEqual({ kind: 'pause', on: undefined, note: 'Holiday' });
  });
});
