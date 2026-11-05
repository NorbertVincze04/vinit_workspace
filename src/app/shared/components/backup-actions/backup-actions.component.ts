import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { ButtonComponent, IconComponent } from '../../ui';

/**
 * "Export backup" + "Import" buttons with a hidden file picker. The page does the actual work.
 *   <app-backup-actions (exportBackup)="store.export()" (importBackup)="import($event)" />
 */
@Component({
  selector: 'app-backup-actions',
  standalone: true,
  imports: [ButtonComponent, IconComponent],
  template: `
    <button appButton size="sm" type="button" (click)="exportBackup.emit()">
      <app-icon name="download" [size]="16" /> Export backup
    </button>
    <button appButton size="sm" type="button" (click)="file.click()">
      <app-icon name="upload" [size]="16" /> Import
    </button>
    <input #file type="file" accept="application/json,.json" hidden (change)="onFile($event)" />
  `,
  styles: ':host { display: inline-flex; flex-wrap: wrap; gap: 8px; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackupActionsComponent {
  readonly exportBackup = output<void>();
  readonly importBackup = output<File>();

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.importBackup.emit(file);
    input.value = '';
  }
}
