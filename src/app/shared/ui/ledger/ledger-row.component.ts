import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

/**
 * One row of an <app-ledger>. Project one element per column.
 * When `clickable`, clicking the row (outside links, buttons and fields) emits (activate).
 *   <app-ledger-row clickable (activate)="edit()"> <div>…</div> <div class="cell-num">…</div> </app-ledger-row>
 */
@Component({
  selector: 'app-ledger-row',
  standalone: true,
  template: '<ng-content />',
  host: {
    role: 'listitem',
    '[class.is-clickable]': 'clickable()',
    '(click)': 'onClick($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LedgerRowComponent {
  readonly clickable = input(false, { transform: booleanAttribute });
  readonly activate = output<void>();

  protected onClick(event: MouseEvent): void {
    if (!this.clickable()) return;
    const target = event.target as HTMLElement;
    if (target.closest('a, button, input, select, textarea, label')) return;
    this.activate.emit();
  }
}
