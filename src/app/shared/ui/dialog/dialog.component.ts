import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  input,
  output,
  viewChild,
} from '@angular/core';
import { uid } from '../../../core/utils/id';

/**
 * Modal sheet built on the native <dialog>. Opens as soon as it renders, so show it with @if.
 * Esc, the backdrop-less close and close() all emit (closed) — set your "open" flag to false there.
 *
 *   @if (editing()) {
 *     <app-dialog #d heading="Edit client" (closed)="editing.set(false)">
 *       …body…
 *       <div dialogFooter><button appButton (click)="d.close()">Cancel</button></div>
 *     </app-dialog>
 *   }
 */
@Component({
  selector: 'app-dialog',
  standalone: true,
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogComponent {
  readonly heading = input.required<string>();
  readonly subheading = input('');
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  readonly closed = output<void>();

  protected readonly titleId = uid('dlg-');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => {
      const el = this.dialog().nativeElement;
      if (!el.open) el.showModal();
    });
  }

  close(): void {
    const el = this.dialog().nativeElement;
    if (el.open) el.close();
    else this.closed.emit();
  }
}
