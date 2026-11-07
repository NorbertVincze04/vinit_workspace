import { ChangeDetectionStrategy, Component, computed, model } from '@angular/core';
import { monthName, shiftMonth } from '../../../core/utils/date';

/**
 * ‹ December 2026 › control for a "YYYY-MM" month.
 *   <app-month-switcher [(value)]="month" />
 */
@Component({
  selector: 'app-month-switcher',
  standalone: true,
  template: `
    <button type="button" aria-label="Previous month" (click)="value.set(prev())">‹</button>
    <span aria-live="polite">{{ label() }}</span>
    <button type="button" aria-label="Next month" (click)="value.set(next())">›</button>
  `,
  styles: `
    :host { display: inline-flex; align-items: center; height: 36px; background: var(--surface);
      border: 1px solid var(--line-strong); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
    button { width: 34px; height: 34px; font-size: 18px; line-height: 1; color: var(--muted); background: none; border: 0;
      border-radius: var(--radius-md); cursor: pointer; }
    button:hover { color: var(--ink); background: var(--hover); }
    span { min-width: 124px; text-align: center; font-size: 14px; font-weight: 500; font-variant-numeric: tabular-nums; }
  `,
  host: { role: 'group', 'aria-label': 'Month' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthSwitcherComponent {
  readonly value = model.required<string>();

  protected readonly label = computed(() => monthName(this.value()));
  protected readonly prev = computed(() => shiftMonth(this.value(), -1));
  protected readonly next = computed(() => shiftMonth(this.value(), 1));
}
