import { todayISO } from '../../../core/utils/date';
import { FieldDef, FormValues, SelectOption, StatusTone, asString } from '../../../shared/ui';

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
export const categoryLabel = (c: string): string => CATEGORIES.find((x) => x.value === c)?.label ?? c;

/** API row of GET /deadlines. */
export interface Deadline {
  id: string;
  title: string;
  category: DeadlineCategory;
  dueOn: string;
  salonId: string | null;
  salonName: string | null;
  recurrence: 'none' | 'monthly' | 'quarterly' | 'yearly';
  remindDays: number[];
  sourceType: string | null;
  status: 'open' | 'done' | 'dismissed';
  url: string;
  notes: string;
  /** Negative = late. */
  daysLeft: number;
}

/** "In 3 days", "Today", "2 days late", "Done". */
export function whenInfo(d: Deadline): { text: string; tone: StatusTone } {
  if (d.status === 'done') return { text: 'Done', tone: 'ok' };
  if (d.status === 'dismissed') return { text: 'Dismissed', tone: 'neutral' };
  const n = d.daysLeft;
  if (n < 0) return { text: `${-n} ${n === -1 ? 'day' : 'days'} late`, tone: 'bad' };
  if (n === 0) return { text: 'Today', tone: 'warn' };
  const remind = Math.max(0, ...d.remindDays);
  return { text: n === 1 ? 'Tomorrow' : `In ${n} days`, tone: n <= remind ? 'warn' : 'info' };
}

const MANUAL = CATEGORIES.filter((c) => !['domain_renewal', 'contract_renewal', 'trial_end'].includes(c.value));
const isLink = (v: string): string | null => (/^https?:\/\/\S+$/.test(v) ? null : 'Enter a full link, starting with https://');
const isDayList = (v: string): string | null =>
  /^\s*\d{1,3}(\s*,\s*\d{1,3})*\s*$/.test(v) ? null : 'Use numbers separated by commas, like 14, 3, 0.';

/** Manual deadline form. */
export function deadlineFields(salons: readonly SelectOption[]): FieldDef[] {
  return [
    { key: 'title', label: 'What is due', type: 'text', required: true, maxLength: 300, span: 'full', placeholder: 'e.g. VAT return, funding application' },
    { key: 'dueOn', label: 'Due on', type: 'date', required: true, default: todayISO },
    { key: 'category', label: 'Type', type: 'select', default: 'tax', options: MANUAL },
    {
      key: 'recurrence',
      label: 'Repeats',
      type: 'select',
      default: 'none',
      options: [
        { value: 'none', label: 'No' },
        { value: 'monthly', label: 'Every month' },
        { value: 'quarterly', label: 'Every 3 months' },
        { value: 'yearly', label: 'Every year' },
      ],
    },
    { key: 'remindDays', label: 'Remind (days before)', type: 'text', default: '14, 3, 0', maxLength: 40, validate: isDayList },
    { key: 'salonId', label: 'Salon', type: 'select', options: [{ value: '', label: 'None' }, ...salons] },
    { key: 'url', label: 'Link', type: 'text', maxLength: 500, placeholder: 'https://…', validate: isLink },
    { key: 'notes', label: 'Notes', type: 'textarea', span: 'full' },
  ];
}

export function deadlineBody(v: FormValues): Record<string, unknown> {
  const remind = asString(v['remindDays'])
    .split(',')
    .map((x) => parseInt(x, 10))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 365);
  return {
    title: asString(v['title']),
    dueOn: asString(v['dueOn']),
    category: asString(v['category']) || 'other',
    recurrence: asString(v['recurrence']) || 'none',
    remindDays: [...new Set(remind)].sort((a, b) => b - a),
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
  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) week.push(new Date(Date.UTC(y, m - 1, 1 - offset + w * 7 + d)).toISOString().slice(0, 10));
    if (w >= 4 && week[0].slice(0, 7) !== monthKey) break;
    weeks.push(week);
  }
  return weeks;
}
