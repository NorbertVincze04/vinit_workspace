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
 * Esc, a click outside the box and close() all emit (closed) — set your "open" flag to false there.
 * With [dirty]="true" (unsaved changes), Esc and clicking outside ask before closing.
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
  /** Unsaved changes: ask before closing with Esc or a click outside. */
  readonly dirty = input(false);

  readonly closed = output<void>();

  protected readonly titleId = uid('dlg-');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => {
      const el = this.dialog().nativeElement;
      if (!el.open) el.showModal();
    });
  }

  /** Set on pointerdown, so selecting text inside and releasing outside doesn't close. */
  protected pressedOutside = false;

  /** The <dialog> fills its box, so a target equal to it (outside its rect) means the backdrop. */
  protected isBackdrop(e: MouseEvent): boolean {
    const el = this.dialog().nativeElement;
    if (e.target !== el) return false;
    const r = el.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  }

  protected onClick(e: MouseEvent): void {
    const outside = this.pressedOutside && this.isBackdrop(e);
    this.pressedOutside = false;
    if (outside && this.mayClose()) this.close();
  }

  protected onCancel(e: Event): void {
    if (!this.mayClose()) e.preventDefault();
  }

  private mayClose(): boolean {
    return !this.dirty() || confirm('Discard your changes?');
  }

  close(): void {
    const el = this.dialog().nativeElement;
    if (el.open) el.close();
    else this.closed.emit();
  }
}
