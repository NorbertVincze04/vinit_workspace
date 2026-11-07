import { Deadline, deadlineBody, monthWeeks, reminderLabel, whenInfo } from './calendar.model';

const deadline = (p: Partial<Deadline>): Deadline => ({
  id: 'd',
  title: 'VAT',
  category: 'tax',
  dueOn: '2026-11-20',
  allDay: true,
  dueTime: null,
  salonId: null,
  salonName: null,
  recurrence: 'none',
  reminders: [20160, 4320, 0],
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

  it('shows the time of timed deadlines', () => {
    expect(whenInfo(deadline({ daysLeft: 0, allDay: false, dueTime: '14:30' })).text).toBe('Today at 14:30');
    expect(whenInfo(deadline({ daysLeft: 1, allDay: false, dueTime: '08:00' })).text).toBe('Tomorrow at 08:00');
  });

  it('reads all day or a time and the reminders from the form', () => {
    expect(deadlineBody({ title: 'x', dueOn: '2026-12-01', when: 'allday', dueTime: '10:00', reminders: ['0', '10080', '1440', '0'] })).toEqual(
      jasmine.objectContaining({ allDay: true, dueTime: null, reminders: [10080, 1440, 0] }),
    );
    expect(deadlineBody({ title: 'x', dueOn: '2026-12-01', when: 'time', dueTime: '10:15', reminders: ['15'] })).toEqual(
      jasmine.objectContaining({ allDay: false, dueTime: '10:15', reminders: [15] }),
    );
  });

  it('labels reminders', () => {
    expect(reminderLabel(0, true)).toBe('On the day (09:00)');
    expect(reminderLabel(0, false)).toBe('At the time');
    expect(reminderLabel(120, false)).toBe('2 hours before');
    expect(reminderLabel(20160, true)).toBe('2 weeks before');
    expect(reminderLabel(4320, true)).toBe('3 days before');
    expect(reminderLabel(90, false)).toBe('1 h 30 min before');
  });
});
