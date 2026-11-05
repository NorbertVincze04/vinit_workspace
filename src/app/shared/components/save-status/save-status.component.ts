import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { StorageService } from '../../../core/services/storage.service';

/**
 * Footnote telling the user where their data lives; switches to a warning if saving fails.
 *   <app-save-status message="Progress saves automatically in this browser." />
 */
@Component({
  selector: 'app-save-status',
  standalone: true,
  template: `
    <p class="eyebrow" [class.failed]="storage.writeFailed()" role="status">
      {{ storage.writeFailed() ? failedMessage() : message() }}
    </p>
  `,
  styles: `
    :host { display: block; margin-top: 28px; text-align: center; }
    .failed { color: var(--red); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaveStatusComponent {
  protected readonly storage = inject(StorageService);

  readonly message = input('Saved automatically in this browser.');
  readonly failedMessage = input('Could not save in this browser. Export a backup to keep your work.');
}
