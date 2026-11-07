import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { downloadJson, readJsonFile } from '../../../core/utils/file';
import { ConfirmDialogComponent, IconComponent, MenuComponent, MenuItemComponent } from '../../ui';

/** A store whose data can be exported to and restored from a JSON backup. */
export interface Backupable {
  snapshot(): unknown;
  /** Replaces the store's data. Returns false when the data is not a valid backup. */
  importState(data: unknown): boolean;
}

/**
 * "⋯" menu with Export backup / Import backup for a tool's store. Import asks before it
 * replaces anything. Extra menu items (e.g. Reset) can be projected after the built-in ones.
 *
 *   <app-backup-menu [store]="store" name="clients">
 *     <button appMenuItem tone="danger" type="button" (click)="askReset()">Reset…</button>
 *   </app-backup-menu>
 */
@Component({
  selector: 'app-backup-menu',
  standalone: true,
  imports: [MenuComponent, MenuItemComponent, IconComponent, ConfirmDialogComponent],
  template: `
    <app-menu [ariaLabel]="'More ' + name() + ' actions'">
      <button appMenuItem type="button" (click)="export()">
        <app-icon name="download" [size]="16" /> Export backup
      </button>
      <button appMenuItem type="button" (click)="picker.click()">
        <app-icon name="upload" [size]="16" /> Import backup…
      </button>
      <ng-content />
    </app-menu>
    <input #picker type="file" accept="application/json,.json" hidden (change)="onFile($event)" />

    @if (pending(); as p) {
      <app-confirm-dialog
        heading="Import backup?"
        [message]="'All current ' + name() + ' data will be replaced with “' + p.file + '”. Export a backup first if you want to keep it.'"
        confirmLabel="Replace data"
        cancelLabel="Cancel"
        (confirmed)="restore(p.data)"
        (closed)="pending.set(null)"
      />
    }
  `,
  styles: ':host { display: inline-flex; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackupMenuComponent {
  readonly store = input.required<Backupable>();
  /** Lower-case name of the data, used in file names and messages ("clients"). */
  readonly name = input.required<string>();

  protected readonly pending = signal<{ file: string; data: unknown } | null>(null);
  private readonly toast = inject(ToastService);

  protected export(): void {
    downloadJson(this.store().snapshot(), `vinit-${this.name()}-backup.json`);
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      this.pending.set({ file: file.name, data: await readJsonFile(file) });
    } catch {
      this.toast.show(`That file is not a valid ${this.name()} backup.`);
    }
  }

  protected restore(data: unknown): void {
    const ok = this.store().importState(data);
    this.toast.show(ok ? 'Backup imported' : `That file is not a valid ${this.name()} backup.`);
  }
}
