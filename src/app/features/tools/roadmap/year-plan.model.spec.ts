import { Goals, PlanYear, YearResults } from './roadmap.store';
import { goalBody, goalRows, goalValue, goalValues, yearLabel } from './year-plan.model';

const goals: Goals = {
  payingSalons: 50,
  breakEvenSalons: 43,
  mrrBani: 750000,
  incomeBani: null,
  monthlyCostsBani: 638000,
  retentionPct: 70,
  onboardingHours: 48,
  smsMonthlyBudget: 1500,
  operationalCostsBani: 260000,
};

const year = (p: Partial<PlanYear>): PlanYear => ({ year: 1, from: '2026-12', to: '2027-11', status: 'past', goals, effective: goals, notes: '', phases: [], ...p });

const results: YearResults = {
  year: 1,
  from: '2026-12',
  to: '2027-11',
  months: 12,
  actual: { payingSalons: 52, mrrBani: 700000, incomeBani: 5000000, monthlyCostsBani: 700000, retentionPct: 75, onboardingHours: 30, smsMonthlyMax: 900 },
  steps: { done: 20, total: 22 },
  newPaying: 55,
  churned: 3,
};

describe('year plan', () => {
  it('compares each goal with what happened', () => {
    const rows = Object.fromEntries(goalRows(year({}), results).map((r) => [r.def.key, r]));
    expect(rows['payingSalons'].status).toEqual({ text: 'Reached', tone: 'ok' });
    expect(rows['mrrBani'].status).toEqual({ text: 'Missed', tone: 'bad' });
    expect(rows['mrrBani'].percent).toBe(93);
    // Ceilings: costs over, hours within.
    expect(rows['monthlyCostsBani'].status).toEqual({ text: 'Over', tone: 'bad' });
    expect(rows['onboardingHours'].status).toEqual({ text: 'Within', tone: 'ok' });
    // Not set → nothing to compare.
    expect(rows['incomeBani'].status).toBeNull();
  });

  it('shows progress, not "missed", while the year runs', () => {
    const rows = goalRows(year({ status: 'current' }), { ...results, months: 3 });
    expect(rows.find((r) => r.def.key === 'mrrBani')!.status).toEqual({ text: '93%', tone: 'info' });
  });

  it('reads goals in RON and back to bani; empty = not set', () => {
    const values = goalValues(year({ goals: { ...goals, mrrBani: 750050 } }));
    expect(values['mrrBani']).toBe('7500,5');
    expect(values['incomeBani']).toBe('');
    const body = goalBody({ ...values, incomeBani: '120000', retentionPct: '' });
    expect(body).toEqual(jasmine.objectContaining({ mrrBani: 750050, incomeBani: 12000000, retentionPct: null, payingSalons: 50 }));
  });

  it('formats values and the year', () => {
    expect(goalValue('money', 750000)).toBe('7.500 RON');
    expect(goalValue('pct', 70)).toBe('70%');
    expect(goalValue('count', null)).toBe('—');
    expect(yearLabel({ from: '2026-12', to: '2027-11' })).toBe('Dec 2026 – Nov 2027');
  });
});
