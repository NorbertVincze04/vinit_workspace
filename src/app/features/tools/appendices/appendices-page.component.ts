import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { downloadBlob } from '../../../core/utils/file';
import { plural } from '../../../core/utils/format';
import { SaveStatusComponent } from '../../../shared/components';
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
import { Appendix, AppendixFilters, MAX_FILE_BYTES, formatBytes } from './appendices.model';
import { AppendicesStore } from './appendices.store';
import { AppendixRowComponent } from './components/appendix-row/appendix-row.component';
import { UploadZoneComponent } from './components/upload-zone/upload-zone.component';

/** Appendices tool: upload supporting files (PDF, PowerPoint, Excel…), download and delete them. */
@Component({
  selector: 'app-appendices-page',
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
    SaveStatusComponent,
    UploadZoneComponent,
    AppendixRowComponent,
  ],
  templateUrl: './appendices-page.component.html',
  styles: '.summary { margin: -4px 0 12px; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppendicesPageComponent {
  protected readonly store = inject(AppendicesStore);
  private readonly toast = inject(ToastService);

  protected readonly maxSize = formatBytes(MAX_FILE_BYTES);
  protected readonly deleting = signal<Appendix | null>(null);
  protected readonly downloadingId = signal<string | null>(null);

  protected readonly summary = computed<InlineStat[]>(() => {
    const count = this.store.appendices().length;
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

  protected async download(appendix: Appendix): Promise<void> {
    this.downloadingId.set(appendix.id);
    const blob = await this.store.file(appendix);
    this.downloadingId.set(null);
    if (blob) {
      downloadBlob(blob, appendix.name);
    } else {
      this.toast.show(`${appendix.name} is no longer stored in this browser. Delete it and upload it again.`, 6000);
    }
  }

  protected async confirmDelete(appendix: Appendix): Promise<void> {
    await this.store.remove(appendix);
    this.toast.show(`Deleted ${appendix.name}`);
  }

  protected setKind(value: string): void {
    this.store.setFilters({ kind: value as AppendixFilters['kind'] });
  }
}
