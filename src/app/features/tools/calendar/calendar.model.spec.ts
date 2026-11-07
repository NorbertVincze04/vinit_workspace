import { Deadline, deadlineBody, monthWeeks, whenInfo } from './calendar.model';

const deadline = (p: Partial<Deadline>): Deadline => ({
  id: 'd',
  title: 'VAT',
  category: 'tax',
  dueOn: '2026-11-20',
  salonId: null,
  salonName: null,
  recurrence: 'none',
  remindDays: [14, 3, 0],
  sourceType: null,
  status: 'open',
  url: '',
  notes: '',
  daysLeft: 10,
  ...p,
});

describe('calendar', () => {
  it('lays out a month Monday first', () => {
    const weeks = monthWeeks('2026-11');
    // 1 Nov 2026 is a Sunday: the first row starts on Monday 26 October.
    expect(weeks[0][0]).toBe('2026-10-26');
    expect(weeks[0][6]).toBe('2026-11-01');
    // Monday 30 November needs a sixth row.
    expect(weeks.at(-1)![6]).toBe('2026-12-06');
    expect(weeks.length).toBe(6);
    expect(monthWeeks('2027-03').length).toBe(5);
  });

  it('says when a deadline is due, warning inside the reminder window', () => {
    expect(whenInfo(deadline({ daysLeft: 20 }))).toEqual({ text: 'In 20 days', tone: 'info' });
    expect(whenInfo(deadline({ daysLeft: 10 })).tone).toBe('warn');
    expect(whenInfo(deadline({ daysLeft: 1 })).text).toBe('Tomorrow');
    expect(whenInfo(deadline({ daysLeft: 0 })).text).toBe('Today');
    expect(whenInfo(deadline({ daysLeft: -2 }))).toEqual({ text: '2 days late', tone: 'bad' });
    expect(whenInfo(deadline({ status: 'done', daysLeft: -2 })).text).toBe('Done');
  });

  it('reads the reminder days from the form', () => {
    expect(deadlineBody({ title: 'x', dueOn: '2026-12-01', remindDays: '3, 14,0, 3' })['remindDays']).toEqual([14, 3, 0]);
  });
});
