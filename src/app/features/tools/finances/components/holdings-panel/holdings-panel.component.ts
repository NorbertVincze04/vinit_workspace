import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import {
  ButtonComponent,
  EmptyStateComponent,
  InlineStatsComponent,
  LedgerComponent,
  LedgerRowComponent,
} from '../../../../../shared/ui';
import { Holding } from '../../finances.model';
import { FinancesStore } from '../../finances.store';
import { AmountComponent } from '../amount/amount.component';
import { TPipe } from '../../../../../core/i18n/t.pipe';

/** Investments tab: what was put in, what it is worth and the return. */
@Component({
  selector: 'app-holdings-panel',
  standalone: true,
  imports: [TPipe, ButtonComponent, EmptyStateComponent, InlineStatsComponent, LedgerComponent, LedgerRowComponent, AmountComponent],
  template: `
    <div class="toolbar">
      <app-inline-stats class="grow" [items]="store.holdings.items().length ? store.holdingSummary() : []" />
    </div>

    @if (!store.holdingRows().length) {
      <app-empty-state
        heading="No investments yet"
        text="Add each ETF, stock, crypto, bond or deposit with its current value. Log contributions as Invest entries and link them to see the real return."
      >
        <button appButton variant="primary" type="button" (click)="add.emit()">{{ 'Add an investment' | t }}</button>
      </app-empty-state>
    } @else {
      <app-ledger
        [headers]="['Investment', 'Invested', 'Value', 'Return', '']"
        [numeric]="[1, 2, 3]"
        columns="minmax(0, 1.6fr) 130px 150px 140px auto"
      >
        @for (row of store.holdingRows(); track row.item.id) {
          <app-ledger-row clickable (activate)="edit.emit(row.item)">
            <div>
              <span class="cell-title">{{ row.item.name || ('Untitled' | t) }}</span>
              <span class="cell-sub">{{ row.sub }}</span>
            </div>
            <app-amount label="Invested" [text]="row.investedText" />
            <app-amount label="Value" [text]="row.valueText" [sub]="row.ronText" />
            <app-amount
              label="Return"
              [text]="row.gainText"
              [sub]="row.gainPctText"
              [kind]="row.gainNegative ? 'negative' : 'positive'"
            />
            <div class="cell-actions">
              <button appButton variant="ghost" size="sm" type="button" (click)="edit.emit(row.item)">{{ 'Edit' | t }}</button>
              <button appButton variant="ghost" size="sm" type="button" (click)="remove.emit(row.item)">{{ 'Delete' | t }}</button>
            </div>
          </app-ledger-row>
        }
      </app-ledger>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HoldingsPanelComponent {
  protected readonly store = inject(FinancesStore);

  readonly add = output<void>();
  readonly edit = output<Holding>();
  readonly remove = output<Holding>();
}
