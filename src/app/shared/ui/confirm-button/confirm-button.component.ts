import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  booleanAttribute,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ButtonComponent, ButtonSize, ButtonVariant } from '../button/button.component';

/**
 * Two-click button for destructive actions: the first click arms it, the second confirms.
 * Disarms itself after `timeout` ms.
 *   <app-confirm-button label="Delete task" confirmLabel="Click again to delete" (confirmed)="remove()" />
 */
@Component({
  selector: 'app-confirm-button',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <button appButton type="button" [size]="size()" [iconOnly]="iconOnly()"
      [variant]="armed() ? 'danger' : variant()"
      [attr.aria-label]="ariaLabel() ? (armed() ? 'Click again to confirm: ' + ariaLabel() : ariaLabel()) : null"
      (click)="onClick()">
      {{ armed() ? confirmLabel() : label() }}
    </button>
  `,
  styles: ':host { display: inline-flex; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmButtonComponent {
  readonly label = input.required<string>();
  readonly confirmLabel = input('Click again to confirm');
  readonly ariaLabel = input('');
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly iconOnly = input(false, { transform: booleanAttribute });
  readonly timeout = input(3500);

  readonly confirmed = output<void>();

  protected readonly armed = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected onClick(): void {
    clearTimeout(this.timer);
    if (this.armed()) {
      this.armed.set(false);
      this.confirmed.emit();
      return;
    }
    this.armed.set(true);
    this.timer = setTimeout(() => this.armed.set(false), this.timeout());
  }
}
