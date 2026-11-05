import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';

/**
 * Ruled list with a header row. Rows are <app-ledger-row> elements (directly or inside your own row
 * components); they share the column layout through the --ledger-cols variable.
 *
 *   <app-ledger [headers]="['Salon', 'Contact', 'Status', '']" columns="2fr 1.5fr 140px auto" [numeric]="[]">
 *     @for (c of clients(); track c.id) { <app-client-row [client]="c" /> }
 *   </app-ledger>
 *
 * Cell helpers (global, see ledger.css): .cell-title, .cell-sub, .cell-num, .cell-actions
 */
@Component({
  selector: 'app-ledger',
  standalone: true,
  template: `
    @if (headers().length) {
      <div class="ledger-head" aria-hidden="true">
        @for (header of headers(); track $index) {
          <span [class.cell-num]="numeric().includes($index)">{{ header }}</span>
        }
      </div>
    }
    <ng-content />
  `,
  styleUrl: './ledger.css',
  encapsulation: ViewEncapsulation.None,
  host: { role: 'list', '[style.--ledger-cols]': 'columns()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LedgerComponent {
  /** Column titles; pass [] for a list without a header row. */
  readonly headers = input<readonly string[]>([]);
  /** CSS grid-template-columns shared by the header and every row. */
  readonly columns = input.required<string>();
  /** Header indexes to right-align (amount columns). */
  readonly numeric = input<readonly number[]>([]);
}
