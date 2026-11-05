import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button.component';
import { DialogComponent } from '../dialog/dialog.component';

/**
 * "Are you sure?" modal for deletes. Show it with @if.
 *   @if (deleting(); as c) {
 *     <app-confirm-dialog heading="Delete client?" [message]="…" (confirmed)="remove(c)" (closed)="deleting.set(null)" />
 *   }
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [DialogComponent, ButtonComponent],
  template: `
    <app-dialog #dialog size="sm" [heading]="heading()" (closed)="closed.emit()">
      <p>{{ message() }}</p>
      <div dialogFooter>
        <button appButton type="button" (click)="dialog.close()">{{ cancelLabel() }}</button>
        <button appButton type="button" variant="danger" (click)="confirm(dialog)">{{ confirmLabel() }}</button>
      </div>
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Delete');
  readonly cancelLabel = input('Keep it');

  readonly confirmed = output<void>();
  readonly closed = output<void>();

  protected confirm(dialog: DialogComponent): void {
    this.confirmed.emit();
    dialog.close();
  }
}
