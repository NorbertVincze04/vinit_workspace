import { Injectable, computed, inject, signal } from '@angular/core';
import { FileStorageService } from '../../../core/services/file-storage.service';
import { persistedCollection } from '../../../core/utils/persisted-collection';
import { matchesSearch } from '../../../core/utils/text';
import { ChipOption } from '../../../shared/ui';
import { FILE_KINDS, FileFilters, MAX_FILE_BYTES, StoredFile, formatBytes, kindInfo, kindOf } from './files.model';

export interface UploadResult {
  added: StoredFile[];
  /** "name: reason" for every file that was not saved. */
  failed: string[];
}

/**
 * Files tool state. The file list is saved in localStorage under "vinit.appendices.v1"
 * (the tool's original name — kept so existing uploads stay visible), the bytes in IndexedDB.
 */
@Injectable({ providedIn: 'root' })
export class FilesStore {
  private readonly collection = persistedCollection<StoredFile>('appendices.v1', 'a');
  private readonly blobs = inject(FileStorageService);

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

  constructor() {
    void this.removeOrphans();
  }

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
          result.added.push(await this.save(file));
        }
      } catch {
        result.failed.push(`${file.name}: the browser's storage is full or blocked`);
      } finally {
        this.uploading.update((n) => n - 1);
      }
    }
    return result;
  }

  /** The stored bytes, or null when they are missing from this browser. */
  async blob(item: StoredFile): Promise<Blob | null> {
    try {
      return await this.blobs.get(item.id);
    } catch {
      return null;
    }
  }

  async remove(item: StoredFile): Promise<void> {
    this.collection.remove(item.id);
    await this.blobs.delete(item.id).catch(() => undefined);
  }

  private async save(file: File): Promise<StoredFile> {
    // If the bytes can't be stored, the record is removed again so the list never shows a broken file.
    const item = this.collection.add({ name: file.name, type: file.type, size: file.size, kind: kindOf(file.name, file.type) });
    try {
      await this.blobs.put(item.id, file);
      return item;
    } catch (error) {
      this.collection.remove(item.id);
      throw error;
    }
  }

  /** Drops stored bytes whose record was deleted (e.g. site data partly cleared). */
  private async removeOrphans(): Promise<void> {
    try {
      const stored = await this.blobs.keys();
      const known = new Set(this.items().map((f) => f.id));
      await Promise.all(stored.filter((id) => !known.has(id)).map((id) => this.blobs.delete(id)));
    } catch {
      /* storage unavailable: nothing to clean */
    }
  }
}
