import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatRon } from '../../../../../core/utils/format';
import { MeterComponent, StatusPillComponent } from '../../../../../shared/ui';
import { CategorySpend } from '../../finances.model';

/** Top spending categories of the month, each with its budget marker. */
@Component({
  selector: 'app-category-spending',
  standalone: true,
  imports: [MeterComponent, StatusPillComponent],
  template: `
    @if (!rows().length) {
      <p class="quiet">No expenses logged for this month yet. Add an expense or set a budget to see where the money goes.</p>
    } @else {
      <ul>
        @for (row of rows(); track row.name) {
          <li>
            <div class="top">
              <span class="name">
                {{ row.name }}
                @if (row.over) {
                  <app-status-pill tone="bad">Over by {{ ron(row.spent - (row.budget ?? 0)) }}</app-status-pill>
                }
              </span>
              <span class="amt"><strong>{{ ron(row.spent) }}</strong>{{ row.budget !== null ? ' / ' + ron(row.budget) : '' }}</span>
            </div>
            <app-meter
              [value]="(row.spent / scale()) * 100"
              [marker]="row.budget !== null ? (row.budget / scale()) * 100 : null"
              [over]="row.over"
              [label]="row.name + ': ' + ron(row.spent) + (row.budget !== null ? ' of ' + ron(row.budget) + ' budget' : '')"
            />
          </li>
        }
      </ul>
      @if (hidden()) {
        <p class="quiet">{{ hidden() }} smaller categories not shown.</p>
      }
    }
  `,
  styles: `
    :host { display: grid; gap: 10px; }
    ul { list-style: none; padding: 0; display: grid; gap: 12px; }
    li { display: grid; gap: 6px; }
    .top { display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px; }
    .name { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .amt { color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .amt strong { color: var(--ink); }
    .quiet { font-size: 13.5px; color: var(--muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategorySpendingComponent {
  readonly rows = input.required<readonly CategorySpend[]>();
  readonly hidden = input(0);

  protected readonly ron = formatRon;
  protected readonly scale = computed(
    () => Math.max(1, ...this.rows().map((r) => Math.max(r.spent, r.budget ?? 0))),
  );
}
