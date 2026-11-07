import { timeBody, timeFields } from './support.fields';
import { duration, ticketNo } from './support.model';

describe('support helpers', () => {
  it('formats durations and ticket numbers', () => {
    expect(duration(25)).toBe('25m');
    expect(duration(60)).toBe('1h');
    expect(duration(95)).toBe('1h 35m');
    expect(ticketNo(42)).toBe('T-0042');
  });

  it('defaults to an included session only while some are left', () => {
    const kind = (remaining: number | null) => timeFields(remaining, null).find((f) => f.key === 'kind')!;
    expect(kind(2).default).toBe('included_session');
    expect(kind(0).default).toBe('billable');
    expect((kind(0).options as readonly { label: string }[])[0].label).toBe('Included session (0 left)');
  });

  it('sends whole minutes and an empty ticket as null', () => {
    expect(timeBody({ kind: 'billable', minutes: 49.6, workedOn: '2026-11-07', ticketId: '', description: 'x' })).toEqual({
      kind: 'billable',
      minutes: 50,
      workedOn: '2026-11-07',
      ticketId: null,
      description: 'x',
    });
  });
});
