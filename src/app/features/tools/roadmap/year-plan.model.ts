import { monthName, shiftMonth } from '../../../core/utils/date';
import { formatNumber, formatRon, percent } from '../../../core/utils/format';
import { FieldDef, FormValues, SelectOption, StatusTone, asString } from '../../../shared/ui';
import { GoalKey, Goals, PlanPhase, PlanYear, YearResults } from './roadmap.store';

type Kind = 'count' | 'money' | 'pct' | 'hours';

export interface GoalDef {
  key: GoalKey;
  group: 'Salons' | 'Money' | 'Quality' | 'Operations';
  label: string;
  kind: Kind;
  /** A ceiling (costs, hours, SMS): met when the actual stays at or under it. */
  atMost?: boolean;
  /** The matching actual, or null when it isn't measured. */
  actual: (r: YearResults) => number | null;
  hint: string;
}

export const GOALS: readonly GoalDef[] = [
  { key: 'payingSalons', group: 'Salons', label: 'Paying salons at year end', kind: 'count', actual: (r) => r.actual.payingSalons, hint: 'Active or past-due subscriptions.' },
  { key: 'breakEvenSalons', group: 'Salons', label: 'Break-even', kind: 'count', actual: (r) => r.actual.payingSalons, hint: 'Paying salons that cover the monthly costs.' },
  { key: 'mrrBani', group: 'Money', label: 'Monthly recurring income at year end', kind: 'money', actual: (r) => r.actual.mrrBani, hint: 'MRR from Subscriptions.' },
  { key: 'incomeBani', group: 'Money', label: 'Income in the year', kind: 'money', actual: (r) => r.actual.incomeBani, hint: 'Business income in Finances (EUR/USD converted).' },
  { key: 'monthlyCostsBani', group: 'Money', label: 'Monthly costs', kind: 'money', atMost: true, actual: (r) => r.actual.monthlyCostsBani, hint: 'Average business expenses a month in Finances.' },
  { key: 'retentionPct', group: 'Quality', label: 'Retention', kind: 'pct', actual: (r) => r.actual.retentionPct, hint: 'Salons paying at the start of the year still with you at the end.' },
  { key: 'onboardingHours', group: 'Quality', label: 'Onboarding time', kind: 'hours', atMost: true, actual: (r) => r.actual.onboardingHours, hint: 'Average from materials received to live.' },
  { key: 'smsMonthlyBudget', group: 'Operations', label: 'SMS a month', kind: 'count', atMost: true, actual: (r) => r.actual.smsMonthlyMax, hint: 'The busiest month (Infra).' },
  { key: 'operationalCostsBani', group: 'Operations', label: 'Operational costs a month', kind: 'money', atMost: true, actual: () => null, hint: 'Hosting, tools, accounting. Compare on Infra.' },
];

/** 750000 bani → "7.500 RON", 48 → "48 h", 70 → "70%". */
export function goalValue(kind: Kind, v: number | null): string {
  if (v === null) return '—';
  if (kind === 'money') return formatRon(v / 100);
  if (kind === 'pct') return `${formatNumber(v)}%`;
  if (kind === 'hours') return `${v.toLocaleString('ro-RO')} h`;
  return formatNumber(v);
}

export interface GoalRow {
  def: GoalDef;
  /** Set for this year (null = not set). */
  set: number | null;
  /** In force (falls back to an earlier year). */
  value: number | null;
  actual: number | null;
  /** 0–100 towards a "reach" goal. */
  percent: number | null;
  status: { text: string; tone: StatusTone } | null;
}

/** Goal vs actual for every goal of a year. Past years say reached / missed; the current one, so far. */
export function goalRows(year: PlanYear, results: YearResults | null): GoalRow[] {
  return GOALS.map((def) => {
    const value = year.effective[def.key];
    const actual = results && results.months > 0 ? def.actual(results) : null;
    let status: GoalRow['status'] = null;
    let pct: number | null = null;
    if (value !== null && actual !== null) {
      if (def.atMost) {
        const ok = actual <= value;
        status = ok ? { text: 'Within', tone: 'ok' } : { text: 'Over', tone: year.status === 'past' ? 'bad' : 'warn' };
      } else {
        pct = Math.min(100, percent(actual, value));
        const ok = actual >= value;
        status = ok ? { text: 'Reached', tone: 'ok' } : year.status === 'past' ? { text: 'Missed', tone: 'bad' } : { text: `${pct}%`, tone: 'info' };
      }
    }
    return { def, set: year.goals[def.key], value, actual, percent: pct, status };
  });
}

/** "Dec 2026 – Nov 2027". */
export function yearLabel(y: Pick<PlanYear, 'from' | 'to'>): string {
  return `${monthName(y.from, true)} ${y.from.slice(0, 4)} – ${monthName(y.to, true)} ${y.to.slice(0, 4)}`;
}

// ---- forms ----

const amount = (v: string): string | null => (/^\d{1,9}([.,]\d{1,2})?$/.test(v.trim()) ? null : 'Enter a number like 7500 or 7500,50.');
const whole = (max: number) => (v: string): string | null => (/^\d+$/.test(v.trim()) && Number(v) <= max ? null : `Enter a whole number up to ${formatNumber(max)}.`);

/** Goals form: leave a goal empty to keep the earlier year's. Money in RON. */
export function goalFields(): FieldDef[] {
  const f = (def: GoalDef): FieldDef => ({
    key: def.key,
    label: `${def.label}${def.kind === 'money' ? ' (RON)' : def.kind === 'pct' ? ' (%)' : def.kind === 'hours' ? ' (hours)' : ''}${def.atMost ? ', at most' : ''}`,
    type: 'text',
    placeholder: 'Not set',
    maxLength: 15,
    validate: def.kind === 'money' ? amount : def.kind === 'pct' ? whole(100) : whole(10_000_000),
  });
  return [...GOALS.map(f), { key: 'notes', label: 'Notes', type: 'textarea', span: 'full', placeholder: 'Assumptions behind the numbers' }];
}

export function goalValues(year: PlanYear): FormValues {
  const out: FormValues = { notes: year.notes };
  for (const def of GOALS) {
    const v = year.goals[def.key];
    out[def.key] = v === null ? '' : def.kind === 'money' ? String(v / 100).replace('.', ',') : String(v);
  }
  return out;
}

export function goalBody(v: FormValues): Partial<Goals> & { notes: string } {
  const out: Partial<Goals> & { notes: string } = { notes: asString(v['notes']) };
  for (const def of GOALS) {
    const t = asString(v[def.key]).trim().replace(',', '.');
    out[def.key] = t === '' ? null : def.kind === 'money' ? Math.round(Number(t) * 100) : Math.round(Number(t));
  }
  return out;
}

/** "Month 3 · Feb 2027" options for a year. */
export function monthOptions(year: Pick<PlanYear, 'from'>): SelectOption[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = shiftMonth(year.from, i);
    return { value: String(i + 1), label: `Month ${i + 1} · ${monthName(m, true)} ${m.slice(0, 4)}` };
  });
}

export function phaseFields(year: Pick<PlanYear, 'from'>): FieldDef[] {
  const months = monthOptions(year);
  return [
    { key: 'name', label: 'Phase', type: 'text', required: true, maxLength: 60, placeholder: 'e.g. Expand' },
    { key: 'goal', label: 'Aim', type: 'text', maxLength: 300, placeholder: 'One line: what this phase is for' },
    { key: 'monthFrom', label: 'From', type: 'select', default: '1', options: months },
    { key: 'monthTo', label: 'To', type: 'select', default: '3', options: months },
    { key: 'milestone', label: 'Done when', type: 'text', maxLength: 300, span: 'full', placeholder: 'e.g. 100 paying salons' },
  ];
}

export const phaseValues = (p: PlanPhase): FormValues => ({ name: p.name, goal: p.goal, monthFrom: String(p.monthFrom), monthTo: String(p.monthTo), milestone: p.milestone });

export function phaseBody(v: FormValues): Partial<PlanPhase> {
  return {
    name: asString(v['name']),
    goal: asString(v['goal']),
    monthFrom: Number(asString(v['monthFrom'])) || 1,
    monthTo: Number(asString(v['monthTo'])) || 12,
    milestone: asString(v['milestone']),
  };
}
