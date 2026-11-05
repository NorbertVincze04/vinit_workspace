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
    :host { display: inline-flex; align-items: center; background: var(--surface); border: 1px solid var(--line);
      border-radius: var(--radius-md); }
    button { width: 38px; height: 38px; font-size: 20px; line-height: 1; color: var(--ink); background: none; border: 0;
      border-radius: var(--radius-sm); cursor: pointer; }
    button:hover { background: var(--main-soft); }
    span { min-width: 140px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; }
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
