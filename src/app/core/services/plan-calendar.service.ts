import { Injectable, computed } from '@angular/core';
import { remoteSetting } from '../api/remote-setting';
import { locale } from '../i18n/i18n';
import { isMonthKey } from '../utils/date';

export const DEFAULT_PLAN_START = '2026-12';
/** Short month names in the app's language: "Dec" / "dec.". */
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(locale(), { month: 'short' }));

/**
 * The Year-1 plan calendar shared by every tool: which calendar month is "Month 1",
 * labels for plan months and today's plan month. Change it once, all tools follow.
 * Saved as the team setting "plan.start".
 */
@Injectable({ providedIn: 'root' })
export class PlanCalendarService {
  private readonly today = new Date();

  /** "YYYY-MM" of plan month 1. */
  readonly start = remoteSetting<string>('plan.start', () => DEFAULT_PLAN_START, isMonthKey);

  /** Plan month number of today (1 = start month; < 1 before the plan starts). */
  readonly currentMonth = computed(() => {
    const { year, month } = this.parts();
    return this.today.getFullYear() * 12 + this.today.getMonth() - (year * 12 + month - 1) + 1;
  });

  setStart(value: string): void {
    if (isMonthKey(value)) this.start.set(value);
  }

  /** "Dec 2026" (Romanian: "dec. 2026") for plan month n. */
  monthLabel(n: number): string {
    const { year, month } = this.parts();
    const index = year * 12 + (month - 1) + (n - 1);
    return `${MONTHS[index % 12]} ${Math.floor(index / 12)}`;
  }

  private parts(): { year: number; month: number } {
    const [y, m] = this.start().split('-');
    return { year: parseInt(y, 10) || 2026, month: parseInt(m, 10) || 12 };
  }
}
