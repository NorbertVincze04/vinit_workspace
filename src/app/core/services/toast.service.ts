import { Injectable, signal } from '@angular/core';

/**
 * Short confirmation messages ("Saved Barber Shop X"). Rendered once by <app-toast> in the app shell.
 *   inject(ToastService).show('Client added');
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(message: string, durationMs = 3200): void {
    clearTimeout(this.timer);
    this.message.set(message);
    this.timer = setTimeout(() => this.message.set(null), durationMs);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.message.set(null);
  }
}
