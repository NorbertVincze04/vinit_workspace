import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { downloadBlob } from '../../../core/utils/file';
import { plural } from '../../../core/utils/format';
import {
  ButtonComponent,
  ChipGroupComponent,
  ConfirmDialogComponent,
  EmptyStateComponent,
  InlineStat,
  InlineStatsComponent,
  LedgerComponent,
  PageHeaderComponent,
  TextFieldComponent,
} from '../../../shared/ui';
import { FileRowComponent } from './components/file-row/file-row.component';
import { UploadZoneComponent } from './components/upload-zone/upload-zone.component';
import { FileFilters, MAX_FILE_BYTES, StoredFile, formatBytes } from './files.model';
import { FilesStore } from './files.store';

/** Files tool: upload shared documents (PDF, PowerPoint, Excel…), download and delete them. */
@Component({
  selector: 'app-files-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    ButtonComponent,
    TextFieldComponent,
    ChipGroupComponent,
    InlineStatsComponent,
    LedgerComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
    UploadZoneComponent,
    FileRowComponent,
  ],
  templateUrl: './files-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilesPageComponent {
  protected readonly store = inject(FilesStore);
  private readonly toast = inject(ToastService);

  protected readonly maxSize = formatBytes(MAX_FILE_BYTES);
  protected readonly deleting = signal<StoredFile | null>(null);
  protected readonly downloadingId = signal<string | null>(null);

  protected readonly summary = computed<InlineStat[]>(() => {
    const count = this.store.items().length;
    return [
      { label: plural(count, 'File', 'Files'), value: String(count) },
      { label: 'Total size', value: formatBytes(this.store.totalSize()) },
    ];
  });

  protected async upload(files: File[]): Promise<void> {
    const { added, failed } = await this.store.upload(files);
    if (failed.length) {
      const saved = added.length ? `Uploaded ${added.length}. ` : '';
      this.toast.show(`${saved}Not uploaded: ${failed.join('; ')}`, 6000);
    } else if (added.length === 1) {
      this.toast.show(`Uploaded ${added[0].name}`);
    } else {
      this.toast.show(`Uploaded ${added.length} files`);
    }
  }

  protected async download(item: StoredFile): Promise<void> {
    this.downloadingId.set(item.id);
    const blob = await this.store.blob(item);
    this.downloadingId.set(null);
    if (blob) {
      downloadBlob(blob, item.name);
    } else {
      this.toast.show(`${item.name} is no longer stored in this browser. Delete it and upload it again.`, 6000);
    }
  }

  protected async confirmDelete(item: StoredFile): Promise<void> {
    await this.store.remove(item);
    this.toast.show(`Deleted ${item.name}`);
  }

  protected setKind(value: string): void {
    this.store.setFilters({ kind: value as FileFilters['kind'] });
  }
}
