import { clockOf } from './onboarding.model';

describe('onboarding clock', () => {
  const base = { status: 'in_progress' as const, late: false, hoursWaitingOnClient: 5, materialsReceivedAt: '2026-11-05T10:00:00Z', hoursUsed: 10 };

  it('waits for the materials before counting', () => {
    expect(clockOf({ ...base, materialsReceivedAt: null, hoursUsed: null, hoursWaitingOnClient: 72 })).toEqual({
      text: 'Waiting for materials (3 days)',
      tone: 'neutral',
      percent: 0,
    });
  });

  it('counts down the 48 hours, warning in the last 12', () => {
    expect(clockOf(base)).toEqual({ text: '38h left', tone: 'info', percent: 21 });
    expect(clockOf({ ...base, hoursUsed: 40.5 }).tone).toBe('warn');
    expect(clockOf({ ...base, hoursUsed: 53, late: true })).toEqual({ text: '5h over 48h', tone: 'bad', percent: 110 });
  });

  it('reports how long going live took', () => {
    expect(clockOf({ ...base, status: 'done', hoursUsed: 31 })).toEqual({ text: 'Live in 31h', tone: 'ok', percent: 65 });
    expect(clockOf({ ...base, status: 'done', hoursUsed: 50, late: true }).text).toBe('Live in 50h (over 48h)');
  });
});
