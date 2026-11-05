import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import {
  ButtonComponent,
  EmptyStateComponent,
  InlineStatsComponent,
  LedgerComponent,
  LedgerRowComponent,
  StatusPillComponent,
} from '../../../../../shared/ui';
import { Account } from '../../finances.model';
import { FinancesStore } from '../../finances.store';
import { AmountComponent } from '../amount/amount.component';

/** Accounts tab: bank accounts, cash and debts that make up the net worth. */
@Component({
  selector: 'app-accounts-panel',
  standalone: true,
  imports: [ButtonComponent, EmptyStateComponent, InlineStatsComponent, LedgerComponent, LedgerRowComponent, StatusPillComponent, AmountComponent],
  template: `
    <div class="toolbar">
      <app-inline-stats class="grow" [items]="store.accounts.items().length ? store.accountSummary() : []" />
      <button appButton size="sm" variant="primary" type="button" (click)="add.emit()">New account</button>
    </div>

    @if (!store.accountRows().length) {
      <app-empty-state
        heading="No accounts yet"
        text="Add bank accounts, cash, e-wallets and any credit card or loan. Their balances make up the net worth."
      >
        <button appButton variant="primary" type="button" (click)="add.emit()">Add an account</button>
      </app-empty-state>
    } @else {
      <app-ledger [headers]="['Account', 'Kind', 'Balance', '']" [numeric]="[2]" columns="minmax(0, 1.6fr) 150px 170px auto">
        @for (row of store.accountRows(); track row.item.id) {
          <app-ledger-row clickable (activate)="edit.emit(row.item)">
            <div>
              <span class="cell-title">{{ row.item.name || 'Untitled' }}</span>
              @if (row.sub) {
                <span class="cell-sub">{{ row.sub }}</span>
              }
            </div>
            <div><app-status-pill [tone]="row.kindTone">{{ row.kindLabel }}</app-status-pill></div>
            <app-amount
              label="Balance"
              [text]="row.balanceText"
              [sub]="row.ronText"
              [kind]="row.liability ? 'negative' : 'plain'"
            />
            <div class="cell-actions">
              <button appButton variant="ghost" size="sm" type="button" (click)="edit.emit(row.item)">Edit</button>
              <button appButton variant="ghost" size="sm" type="button" (click)="remove.emit(row.item)">Delete</button>
            </div>
          </app-ledger-row>
        }
      </app-ledger>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountsPanelComponent {
  protected readonly store = inject(FinancesStore);

  readonly add = output<void>();
  readonly edit = output<Account>();
  readonly remove = output<Account>();
}
