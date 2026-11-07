import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { apiCollection } from '../../../core/api/api-collection';
import { FieldMap, field, fromApi } from '../../../core/api/api-fields';
import { ApiService, apiError } from '../../../core/api/api.service';
import { matchesSearch } from '../../../core/utils/text';
import { ChipOption } from '../../../shared/ui';
import { FILE_KINDS, FileFilters, MAX_FILE_BYTES, StoredFile, formatBytes, kindInfo, kindOf } from './files.model';

export interface UploadResult {
  added: StoredFile[];
  /** "name: reason" for every file that was not saved. */
  failed: string[];
}

const FILE_FIELDS: FieldMap<StoredFile> = {
  name: field.text(),
  type: field.text('mime'),
  size: field.int('sizeBytes'),
  kind: field.text(),
};

/** Files tool state. Files are stored on the server (in Postgres), so every device sees them. */
@Injectable({ providedIn: 'root' })
export class FilesStore {
  private readonly collection = apiCollection<StoredFile>('/files', FILE_FIELDS, 'a');
  private readonly api = inject(ApiService);

  readonly items = this.collection.items;
  readonly filters = signal<FileFilters>({ q: '', kind: 'all' });
  /** Number of files currently being saved. */
  readonly uploading = signal(0);

  readonly totalSize = computed(() => this.items().reduce((sum, f) => sum + (f.size || 0), 0));

  readonly kindChips = computed<ChipOption[]>(() => {
    const list = this.items();
    return [
      { value: 'all', label: 'All', count: list.length },
      ...FILE_KINDS.map((k) => ({ value: k.value, label: k.label, count: list.filter((f) => f.kind === k.value).length }))
        .filter((chip) => chip.count > 0),
    ];
  });

  readonly visible = computed(() => {
    const { q, kind } = this.filters();
    return this.items()
      .filter((f) => kind === 'all' || f.kind === kind)
      .filter((f) => matchesSearch(q, f.name, kindInfo(f.kind).label))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  });

  setFilters(patch: Partial<FileFilters>): void {
    this.filters.update((f) => ({ ...f, ...patch }));
  }

  clearFilters(): void {
    this.filters.set({ q: '', kind: 'all' });
  }

  async upload(list: readonly File[]): Promise<UploadResult> {
    const result: UploadResult = { added: [], failed: [] };
    this.uploading.update((n) => n + list.length);
    for (const file of list) {
      try {
        if (!file.size) {
          result.failed.push(`${file.name}: the file is empty`);
        } else if (file.size > MAX_FILE_BYTES) {
          result.failed.push(`${file.name}: larger than ${formatBytes(MAX_FILE_BYTES)}`);
        } else {
          result.added.push(await this.send(file));
        }
      } catch (error) {
        result.failed.push(`${file.name}: ${apiError(error).message}`);
      } finally {
        this.uploading.update((n) => n - 1);
      }
    }
    return result;
  }

  /**
   * Uploads one file. `keep` preserves the id and date of a file moved from this browser's
   * old storage (see LocalDataService).
   */
  async send(file: Blob, keep?: { id: string; name: string; createdAt: string }): Promise<StoredFile> {
    const form = new FormData();
    const name = keep?.name ?? (file as File).name ?? 'file';
    form.append('name', name);
    if (keep) {
      form.append('id', keep.id);
      if (keep.createdAt) form.append('createdAt', keep.createdAt);
    }
    form.append('file', file, name);
    const res = await this.api.write<{ item: Record<string, unknown> }>('POST', '/files', form);
    const item = fromApi<StoredFile>(FILE_FIELDS, res.item);
    this.collection.setLocal((items) => [...items.filter((x) => x.id !== item.id), item]);
    return item;
  }

  /** The file's bytes, or null when they cannot be downloaded. */
  async blob(item: StoredFile): Promise<Blob | null> {
    try {
      return await this.api.getBlob(`/files/${encodeURIComponent(item.id)}/download`);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) void this.collection.reload();
      return null;
    }
  }

  async remove(item: StoredFile): Promise<void> {
    this.collection.remove(item.id);
  }
}
