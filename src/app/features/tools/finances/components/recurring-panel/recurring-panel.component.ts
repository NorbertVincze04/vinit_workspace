import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import {
  ButtonComponent,
  EmptyStateComponent,
  InlineStatsComponent,
  LedgerComponent,
  LedgerRowComponent,
  StatusPillComponent,
} from '../../../../../shared/ui';
import { Recurring } from '../../finances.model';
import { FinancesStore } from '../../finances.store';
import { AmountComponent } from '../amount/amount.component';

/** Recurring tab: bills, subscriptions and salaries with due dates and a one-click "Log paid". */
@Component({
  selector: 'app-recurring-panel',
  standalone: true,
  imports: [ButtonComponent, EmptyStateComponent, InlineStatsComponent, LedgerComponent, LedgerRowComponent, StatusPillComponent, AmountComponent],
  template: `
    <div class="toolbar">
      <app-inline-stats class="grow" [items]="store.recurringSummary()" />
      <button appButton size="sm" variant="primary" type="button" (click)="add.emit()">New recurring</button>
    </div>

    @if (!store.recurringRows().length) {
      <app-empty-state
        heading="No recurring payments"
        text="Add hosting, software, accounting, salaries and other repeating items once. Each shows when it is due next, and one click logs it as a transaction."
      >
        <button appButton variant="primary" type="button" (click)="add.emit()">Add a recurring payment</button>
      </app-empty-state>
    } @else {
      <app-ledger
        [headers]="['Payment', 'Next due', 'Amount', 'Per month', '']"
        [numeric]="[2, 3]"
        columns="minmax(0, 1.6fr) minmax(0, 1fr) 140px 120px auto"
      >
        @for (row of store.recurringRows(); track row.item.id) {
          <app-ledger-row clickable (activate)="edit.emit(row.item)">
            <div>
              <span class="cell-title">{{ row.item.name || 'Untitled' }}</span>
              <span class="cell-sub">{{ row.sub }}</span>
            </div>
            <div class="due">
              <app-status-pill [tone]="row.dueTone">{{ row.dueLabel }}</app-status-pill>
              <span class="cell-sub">{{ row.dueText }}</span>
            </div>
            <app-amount label="Amount" [text]="row.amountText" [kind]="row.amountClass" />
            <app-amount label="Per month" [text]="row.perMonthText" />
            <div class="cell-actions">
              @if (row.canLog) {
                <button appButton variant="ghost" size="sm" type="button" (click)="log.emit(row.item)">Log paid</button>
              }
              <button appButton variant="ghost" size="sm" type="button" (click)="edit.emit(row.item)">Edit</button>
              <button appButton variant="ghost" size="sm" type="button" (click)="remove.emit(row.item)">Delete</button>
            </div>
          </app-ledger-row>
        }
      </app-ledger>
    }
  `,
  styles: '.due { display: grid; gap: 4px; justify-items: start; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringPanelComponent {
  protected readonly store = inject(FinancesStore);

  readonly add = output<void>();
  readonly edit = output<Recurring>();
  readonly remove = output<Recurring>();
  readonly log = output<Recurring>();
}
