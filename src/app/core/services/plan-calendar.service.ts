import { Injectable, computed, inject } from '@angular/core';
import { isMonthKey } from '../utils/date';
import { persistedSignal } from '../utils/persisted-signal';
import { StorageService } from './storage.service';

export const DEFAULT_PLAN_START = '2026-12';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The Year-1 plan calendar shared by every tool: which calendar month is "Month 1",
 * labels for plan months and today's plan month. Change it once, all tools follow.
 */
@Injectable({ providedIn: 'root' })
export class PlanCalendarService {
  private readonly storage = inject(StorageService);
  private readonly today = new Date();

  /** "YYYY-MM" of plan month 1. */
  readonly start = persistedSignal<string>('plan.start', () => this.legacyStart(), { validate: isMonthKey });

  /** Plan month number of today (1 = start month; < 1 before the plan starts). */
  readonly currentMonth = computed(() => {
    const { year, month } = this.parts();
    return this.today.getFullYear() * 12 + this.today.getMonth() - (year * 12 + month - 1) + 1;
  });

  setStart(value: string): void {
    if (isMonthKey(value)) this.start.set(value);
  }

  /** "Dec 2026" for plan month n. */
  monthLabel(n: number): string {
    const { year, month } = this.parts();
    const index = year * 12 + (month - 1) + (n - 1);
    return `${MONTHS[index % 12]} ${Math.floor(index / 12)}`;
  }

  private parts(): { year: number; month: number } {
    const [y, m] = this.start().split('-');
    return { year: parseInt(y, 10) || 2026, month: parseInt(m, 10) || 12 };
  }

  /** Earlier versions kept the start month inside the Tasks data; reuse it once. */
  private legacyStart(): string {
    const tasks = this.storage.read('tasks.v1') as { start?: unknown } | null;
    return isMonthKey(tasks?.start) ? tasks.start : DEFAULT_PLAN_START;
  }
}
