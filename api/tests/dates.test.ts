import { describe, expect, it } from 'vitest';
import { bucharestTime } from '../src/lib/dates.js';

describe('Bucharest time', () => {
  it('turns a local date and time into the instant, summer and winter', () => {
    expect(bucharestTime('2026-07-01', '09:00').toISOString()).toBe('2026-07-01T06:00:00.000Z');
    expect(bucharestTime('2026-12-01', '09:00').toISOString()).toBe('2026-12-01T07:00:00.000Z');
    // The night clocks go back (25 Oct 2026, 04:00 → 03:00) and forward (28 Mar 2027, 03:00 → 04:00).
    expect(bucharestTime('2026-10-25', '12:00').toISOString()).toBe('2026-10-25T10:00:00.000Z');
    expect(bucharestTime('2027-03-28', '12:00').toISOString()).toBe('2027-03-28T09:00:00.000Z');
    expect(bucharestTime('2027-01-01', '00:00').toISOString()).toBe('2026-12-31T22:00:00.000Z');
  });
});
