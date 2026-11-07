import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import {
  ButtonComponent,
  EmptyStateComponent,
  InlineStatsComponent,
  LedgerComponent,
  LedgerRowComponent,
  MeterComponent,
  StatusPillComponent,
} from '../../../../../shared/ui';
import { Budget } from '../../finances.model';
import { FinancesStore } from '../../finances.store';

/** Budgets tab: monthly limits per category and how much of each is used. */
@Component({
  selector: 'app-budgets-panel',
  standalone: true,
  imports: [ButtonComponent, EmptyStateComponent, InlineStatsComponent, LedgerComponent, LedgerRowComponent, MeterComponent, StatusPillComponent],
  template: `
    <div class="toolbar">
      <app-inline-stats class="grow" [items]="store.budgets.items().length ? store.budgetSummary() : []" />
    </div>

    @if (!store.budgetRows().length) {
      <app-empty-state
        heading="No budgets yet"
        text="Set a monthly limit for categories to keep in check, like advertising or software. Overspending shows up in red."
      >
        <button appButton variant="primary" type="button" (click)="add.emit()">Set a budget</button>
      </app-empty-state>
    } @else {
      <app-ledger [headers]="['Category', 'Used', 'Left', '']" [numeric]="[2]" columns="minmax(0, 1.2fr) minmax(0, 1.4fr) 150px auto">
        @for (row of store.budgetRows(); track row.item.id) {
          <app-ledger-row clickable (activate)="edit.emit(row.item)">
            <div>
              <span class="cell-title">{{ row.item.category }}</span>
              <span class="cell-sub">{{ row.limitText }}</span>
            </div>
            <div class="used">
              <span class="cell-sub"><strong>{{ row.spentText }}</strong> · {{ row.pct }}%</span>
              <app-meter [value]="row.pct" [over]="row.over" [label]="row.pct + '% of budget used'" />
            </div>
            <div class="cell-num">
              @if (row.over) {
                <app-status-pill tone="bad">{{ row.leftText }}</app-status-pill>
              } @else {
                <strong>{{ row.leftText }}</strong>
              }
            </div>
            <div class="cell-actions">
              <button appButton variant="ghost" size="sm" type="button" (click)="edit.emit(row.item)">Edit</button>
              <button appButton variant="ghost" size="sm" type="button" (click)="remove.emit(row.item)">Delete</button>
            </div>
          </app-ledger-row>
        }
      </app-ledger>
    }
  `,
  styles: `
    .used { display: grid; gap: 6px; min-width: 140px; }
    .used strong { color: var(--ink); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetsPanelComponent {
  protected readonly store = inject(FinancesStore);

  readonly add = output<void>();
  readonly edit = output<Budget>();
  readonly remove = output<Budget>();
}
