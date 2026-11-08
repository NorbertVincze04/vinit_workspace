import { todayISO } from '../../../core/utils/date';
import { FieldDef, FormValues, SelectOption, StatusTone, asList, asString } from '../../../shared/ui';
import { countOf, t } from '../../../core/i18n/i18n';
import { translateServer } from '../../../core/i18n/server-messages';

export type DeadlineCategory = 'domain_renewal' | 'contract_renewal' | 'trial_end' | 'tax' | 'accounting' | 'funding' | 'service_subscription' | 'other';

export const CATEGORIES: readonly { value: DeadlineCategory; label: string }[] = [
  { value: 'tax', label: 'Tax' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'funding', label: 'Funding' },
  { value: 'service_subscription', label: 'Service subscription' },
  { value: 'domain_renewal', label: 'Domain / SSL' },
  { value: 'contract_renewal', label: 'Contract renewal' },
  { value: 'trial_end', label: 'Trial end' },
  { value: 'other', label: 'Other' },
];
export const categoryLabel = (c: string): string => t(CATEGORIES.find((x) => x.value === c)?.label ?? c);

/** API row of GET /deadlines. */
export interface Deadline {
  id: string;
  title: string;
  category: DeadlineCategory;
  dueOn: string;
  /** All day, or at dueTime ("HH:MM", Bucharest time). */
  allDay: boolean;
  dueTime: string | null;
  salonId: string | null;
  salonName: string | null;
  recurrence: 'none' | 'monthly' | 'quarterly' | 'yearly';
  /** Minutes before; 0 = at the time (all day: on the day at 09:00). */
  reminders: number[];
  sourceType: string | null;
  status: 'open' | 'done' | 'dismissed';
  url: string;
  notes: string;
  /** Negative = late. */
  daysLeft: number;
}

const DAY = 1440;

/** Reminder choices, like a phone calendar. All-day reminders go off at 09:00. */
export const TIMED_REMINDERS: readonly { minutes: number; label: string }[] = [
  { minutes: 0, label: 'At the time' },
  { minutes: 5, label: '5 minutes before' },
  { minutes: 10, label: '10 minutes before' },
  { minutes: 15, label: '15 minutes before' },
  { minutes: 30, label: '30 minutes before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 120, label: '2 hours before' },
  { minutes: DAY, label: '1 day before' },
  { minutes: 2 * DAY, label: '2 days before' },
  { minutes: 7 * DAY, label: '1 week before' },
];
export const ALL_DAY_REMINDERS: readonly { minutes: number; label: string }[] = [
  { minutes: 0, label: 'On the day (09:00)' },
  { minutes: DAY, label: '1 day before (09:00)' },
  { minutes: 2 * DAY, label: '2 days before (09:00)' },
  { minutes: 7 * DAY, label: '1 week before (09:00)' },
];
const DEFAULT_ALL_DAY = [7 * DAY, DAY, 0];
const DEFAULT_TIMED = [30];

/** 20160 → "2 weeks before", 4320 → "3 days before", 90 → "1 h 30 min before". */
export function reminderLabel(minutes: number, allDay: boolean): string {
  const preset = (allDay ? ALL_DAY_REMINDERS : TIMED_REMINDERS).find((r) => r.minutes === minutes);
  if (preset) return t(preset.label);
  const before = (n: number, one: string, other: string): string => t('{time} before', { time: countOf(n, one, other) });
  if (minutes % (7 * DAY) === 0) return before(minutes / (7 * DAY), 'week', 'weeks');
  if (minutes % DAY === 0) return before(minutes / DAY, 'day', 'days');
  if (minutes % 60 === 0) return before(minutes / 60, 'hour', 'hours');
  return minutes > 60 ? t('{h} h {m} min before', { h: Math.floor(minutes / 60), m: minutes % 60 }) : before(minutes, 'minute', 'minutes');
}

/** "All day" or "14:30". */
export const timeLabel = (d: Pick<Deadline, 'allDay' | 'dueTime'>): string => (d.allDay || !d.dueTime ? t('All day') : d.dueTime);

/** "In 3 days", "Today", "2 days late", "Done". Warning once the earliest reminder has passed. */
export function whenInfo(d: Deadline): { text: string; tone: StatusTone } {
  if (d.status === 'done') return { text: t('Done'), tone: 'ok' };
  if (d.status === 'dismissed') return { text: t('Dismissed'), tone: 'neutral' };
  const n = d.daysLeft;
  const timed = !d.allDay && !!d.dueTime;
  if (n < 0) return { text: t('{days} late', { days: countOf(-n, 'day', 'days') }), tone: 'bad' };
  if (n === 0) return { text: timed ? t('Today at {time}', { time: d.dueTime! }) : t('Today'), tone: 'warn' };
  const remindDays = Math.ceil(Math.max(0, ...d.reminders) / DAY);
  const text = n === 1 ? (timed ? t('Tomorrow at {time}', { time: d.dueTime! }) : t('Tomorrow')) : t('In {days}', { days: countOf(n, 'day', 'days') });
  return { text, tone: n <= remindDays ? 'warn' : 'info' };
}

/** Titles the server generates in English (domains, SSL, contracts, trials, services), in the app's language. */
export function localizeDeadline<D extends Pick<Deadline, 'title' | 'sourceType'>>(d: D): D {
  return d.sourceType ? { ...d, title: translateServer(d.title) } : d;
}

const MANUAL = CATEGORIES.filter((c) => !['domain_renewal', 'contract_renewal', 'trial_end'].includes(c.value));
/** Same rule as the API: a link the browser can parse, http or https. */
const isAllDay = (v: FormValues): boolean => asString(v['when']) !== 'time';

/** Choices for the current mode, plus any older value that isn't a preset (kept when editing). */
function reminderOptions(v: FormValues, keep: readonly number[]): SelectOption[] {
  const allDay = isAllDay(v);
  const presets = (allDay ? ALL_DAY_REMINDERS : TIMED_REMINDERS).map((r) => r.minutes);
  const extra = keep.filter((m) => !presets.includes(m));
  return [...presets, ...extra].sort((a, b) => a - b).map((m) => ({ value: String(m), label: reminderLabel(m, allDay) }));
}

/** Deadline form: title, all day or a time, date, repeat, reminders (like a phone calendar). */
export function deadlineFields(salons: readonly SelectOption[], keepReminders: readonly number[] = []): FieldDef[] {
  return [
    { key: 'title', label: 'What is due', type: 'text', required: true, maxLength: 300, span: 'full', placeholder: 'e.g. VAT return, meeting with the bank' },
    {
      key: 'when',
      label: 'When',
      type: 'switch',
      default: 'allday',
      options: [
        { value: 'allday', label: 'All day' },
        { value: 'time', label: 'At a time' },
      ],
      // Switching resets the reminders to that mode's usual ones.
      onChange: (v) => ({ reminders: (isAllDay(v) ? DEFAULT_ALL_DAY : DEFAULT_TIMED).map(String) }),
    },
    { key: 'dueOn', label: 'Date', type: 'date', required: true, default: todayISO },
    { key: 'dueTime', label: 'Time', type: 'time', required: (v) => !isAllDay(v), show: (v) => !isAllDay(v), default: '09:00' },
    {
      key: 'recurrence',
      label: 'Repeat',
      type: 'select',
      default: 'none',
      options: [
        { value: 'none', label: 'Never' },
        { value: 'monthly', label: 'Every month' },
        { value: 'quarterly', label: 'Every 3 months' },
        { value: 'yearly', label: 'Every year' },
      ],
    },
    {
      key: 'reminders',
      label: 'Remind me',
      type: 'multi',
      span: 'full',
      default: () => DEFAULT_ALL_DAY.map(String),
      options: (v) => reminderOptions(v, keepReminders),
      hint: 'Shows under the bell. Pick none for no reminder.',
    },
    { key: 'category', label: 'Type', type: 'select', default: 'tax', options: MANUAL },
    { key: 'salonId', label: 'Salon', type: 'select', options: [{ value: '', label: 'None' }, ...salons] },
    { key: 'url', label: 'Link', type: 'url', maxLength: 500, placeholder: 'https://anaf.ro/…', hint: 'Where to do it or read about it (optional).', span: 'full' },
    { key: 'notes', label: 'Notes', type: 'textarea', span: 'full', placeholder: 'Anything to remember: documents to bring, who to call…' },
  ];
}

/** Form values of an existing deadline. */
export function deadlineValues(d: Deadline): FormValues {
  return {
    title: d.title,
    when: d.allDay ? 'allday' : 'time',
    dueOn: d.dueOn,
    dueTime: d.dueTime ?? '09:00',
    recurrence: d.recurrence,
    reminders: d.reminders.map(String),
    category: d.category,
    salonId: d.salonId ?? '',
    url: d.url,
    notes: d.notes,
  };
}

export function deadlineBody(v: FormValues): Record<string, unknown> {
  const allDay = isAllDay(v);
  const reminders = asList(v['reminders'])
    .map((x) => parseInt(x, 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return {
    title: asString(v['title']),
    dueOn: asString(v['dueOn']),
    allDay,
    dueTime: allDay ? null : asString(v['dueTime']),
    category: asString(v['category']) || 'other',
    recurrence: asString(v['recurrence']) || 'none',
    reminders: [...new Set(reminders)].sort((a, b) => b - a),
    salonId: asString(v['salonId']) || null,
    url: asString(v['url']),
    notes: asString(v['notes']),
  };
}

/** Weeks (Monday first) covering a month: 5 or 6 rows of 7 ISO dates. */
export function monthWeeks(monthKey: string): string[][] {
  const [y, m] = monthKey.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const weeks: string[][] = [];
  for (let d = 0; d < 6; d++) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) week.push(new Date(Date.UTC(y, m - 1, 1 - offset + d * 7 + i)).toISOString().slice(0, 10));
    if (d >= 4 && week[0].slice(0, 7) !== monthKey) break;
    weeks.push(week);
  }
  return weeks;
}
