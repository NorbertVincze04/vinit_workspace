import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

/** Renders ToastService messages at the bottom of the screen. Place once, in the app shell. */
@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div role="status" aria-live="polite">
      @if (toast.message(); as message) {
        <p class="toast">{{ message }}</p>
      }
    </div>
  `,
  styles: `
    :host { position: fixed; inset: auto 0 0 0; z-index: 200; display: flex; justify-content: center;
      padding: 0 16px 18px; pointer-events: none; }
    .toast { max-width: 560px; padding: 10px 16px; font-size: 14px; font-weight: 500; color: var(--bg);
      background: var(--ink); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); pointer-events: auto; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastComponent {
  protected readonly toast = inject(ToastService);
}
