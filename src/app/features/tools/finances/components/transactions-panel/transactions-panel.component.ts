import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { monthName } from '../../../../../core/utils/date';
import {
  BadgeComponent,
  ButtonComponent,
  ChipGroupComponent,
  ChipOption,
  EmptyStateComponent,
  InlineStatsComponent,
  LedgerComponent,
  LedgerRowComponent,
  SelectFieldComponent,
  SelectOption,
  StatusPillComponent,
  TextFieldComponent,
} from '../../../../../shared/ui';
import { SCOPES, TX_TYPES } from '../../finances.data';
import { Transaction } from '../../finances.model';
import { FinancesStore } from '../../finances.store';
import { AmountComponent } from '../amount/amount.component';

/** Transactions tab: filters, totals and the ledger of entries. */
@Component({
  selector: 'app-transactions-panel',
  standalone: true,
  imports: [
    TextFieldComponent,
    SelectFieldComponent,
    ChipGroupComponent,
    ButtonComponent,
    EmptyStateComponent,
    InlineStatsComponent,
    LedgerComponent,
    LedgerRowComponent,
    StatusPillComponent,
    BadgeComponent,
    AmountComponent,
  ],
  templateUrl: './transactions-panel.component.html',
  styles: `
    .date { display: grid; justify-items: center; line-height: 1.1; font-size: 12px; color: var(--muted); }
    .date strong { font-size: 17px; font-weight: 600; color: var(--ink); }
    .pills { display: flex; flex-wrap: wrap; gap: 6px; }
    /* Phones: the ledger stacks cells, so show the date inline ("3 Nov") above the description. */
    @media (max-width: 760px) {
      .date { grid-auto-flow: column; justify-content: start; align-items: baseline; gap: 5px; font-size: 13px; }
      .date strong { font-size: 15px; }
    }
    app-inline-stats { margin-bottom: 10px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsPanelComponent {
  protected readonly store = inject(FinancesStore);

  readonly add = output<void>();
  readonly edit = output<Transaction>();
  readonly remove = output<Transaction>();
  readonly exportCsv = output<void>();

  protected readonly typeChips: readonly ChipOption[] = [{ value: 'all', label: 'All' }, ...TX_TYPES];
  protected readonly scopeOptions: readonly SelectOption[] = [{ value: 'all', label: 'Business + personal' }, ...SCOPES];
  protected readonly periodOptions = computed<SelectOption[]>(() => [
    { value: 'month', label: monthName(this.store.month()) },
    { value: 'all', label: 'All time' },
  ]);

  protected readonly emptyHeading = computed(() => {
    const f = this.store.txFilters();
    return f.period === 'month' && !f.q && f.type === 'all'
      ? `Nothing logged in ${monthName(this.store.month())}`
      : 'No transactions match';
  });

  protected setPeriod(value: string): void {
    this.store.setTxFilters({ period: value === 'all' ? 'all' : 'month' });
  }
}
