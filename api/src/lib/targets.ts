import type { Knex } from 'knex';
import { addMonths, monthOf, monthStart, monthsBetween, today } from './dates.js';

type Db = Knex | Knex.Transaction;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Built-in goals (the business plan's Year 1). A year's goal that was never set falls back to the
 * previous year's, then to these. Money in bani.
 */
export const TARGETS = {
  /** 43 salons on Standard cover the 6,380 RON monthly costs. */
  breakEvenSalons: 43,
  monthlyCostsBani: 638_000,
  payingSalons: 50,
  mrrBani: 750_000,
  retentionPct: 70,
  onboardingHours: 48,
  /** Early Bird places (a promotion rule, not a yearly goal). */
  earlyBirdLimit: 50,
  /** Twilio budget: ~1,500 SMS a month (300 RON at 0.20 RON). */
  smsMonthlyBudget: 1500,
  /** Operational costs per month in the plan (hosting, tools, accounting…). */
  operationalCostsBani: 260_000,
} as const;

/** The goals you set per plan year (columns of plan_years). */
export const GOAL_KEYS = [
  'payingSalons',
  'breakEvenSalons',
  'mrrBani',
  'incomeBani',
  'monthlyCostsBani',
  'retentionPct',
  'onboardingHours',
  'smsMonthlyBudget',
  'operationalCostsBani',
] as const;
export type GoalKey = (typeof GOAL_KEYS)[number];
export type Goals = Record<GoalKey, number | null>;

/** The goals in force for a month: the plan year's, with fallbacks filled in. */
export interface Targets {
  year: number;
  payingSalons: number;
  breakEvenSalons: number;
  mrrBani: number;
  /** Total income goal for the year; null when never set. */
  incomeBani: number | null;
  monthlyCostsBani: number;
  retentionPct: number;
  onboardingHours: number;
  smsMonthlyBudget: number;
  operationalCostsBani: number;
  earlyBirdLimit: number;
}

export const DEFAULT_PLAN_START = '2026-12';

/** Calendar month of plan month 1 (the "plan.start" setting). */
export async function planStart(k: Db): Promise<string> {
  const row = await k('appSettings').where({ key: 'plan.start' }).first('value');
  return typeof row?.value === 'string' ? row.value : DEFAULT_PLAN_START;
}

/** Plan year of a month: 1 for the first 12 months (and before the start), 2 for the next 12… */
export function yearOfMonth(start: string, month: string): number {
  return Math.max(1, Math.floor(monthsBetween(start, month) / 12) + 1);
}

/** First and last month of a plan year. */
export function yearRange(start: string, year: number): { from: string; to: string } {
  const from = monthOf(addMonths(monthStart(start), (year - 1) * 12));
  return { from, to: monthOf(addMonths(monthStart(from), 11)) };
}

/** Each year's goals with the fallbacks applied (previous year, then the built-in ones). */
export function resolveGoals(rows: readonly Row[]): Map<number, Targets> {
  const out = new Map<number, Targets>();
  const last: Record<string, number | null> = { ...TARGETS, incomeBani: null };
  for (const row of [...rows].sort((a, b) => a.year - b.year)) {
    for (const key of GOAL_KEYS) if (row[key] !== null && row[key] !== undefined) last[key] = Number(row[key]);
    out.set(row.year, { ...(last as unknown as Targets), year: row.year, incomeBani: row.incomeBani === null ? null : Number(row.incomeBani), earlyBirdLimit: TARGETS.earlyBirdLimit });
  }
  return out;
}

/** month → the goals in force (reads the years once). */
export async function targetsLookup(k: Db): Promise<(month: string) => Targets> {
  const [start, rows] = await Promise.all([planStart(k), k('planYears').select('*')]);
  const byYear = resolveGoals(rows);
  const years = [...byYear.keys()];
  return (month) => {
    const year = yearOfMonth(start, month);
    // A year without a row uses the latest year before it.
    const known = years.filter((y) => y <= year);
    const base = known.length ? byYear.get(Math.max(...known))! : ({ ...TARGETS, incomeBani: null, year } as Targets);
    return { ...base, year };
  };
}

/** The goals in force this month (or in `month`). */
export async function targetsFor(k: Db, month = monthOf(today())): Promise<Targets> {
  return (await targetsLookup(k))(month);
}
