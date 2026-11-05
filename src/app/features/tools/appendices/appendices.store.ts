import { Injectable, computed, inject, signal } from '@angular/core';
import { FileStorageService } from '../../../core/services/file-storage.service';
import { persistedCollection } from '../../../core/utils/persisted-collection';
import { matchesSearch } from '../../../core/utils/text';
import { ChipOption } from '../../../shared/ui';
import { Appendix, AppendixFilters, FILE_KINDS, MAX_FILE_BYTES, formatBytes, kindInfo, kindOf } from './appendices.model';

export interface UploadResult {
  added: Appendix[];
  /** "name: reason" for every file that was not saved. */
  failed: string[];
}

/**
 * Appendices tool state. File details are saved in localStorage under "vinit.appendices.v1",
 * the files themselves in IndexedDB (FileStorageService).
 */
@Injectable({ providedIn: 'root' })
export class AppendicesStore {
  private readonly collection = persistedCollection<Appendix>('appendices.v1', 'a');
  private readonly files = inject(FileStorageService);

  readonly appendices = this.collection.items;
  readonly filters = signal<AppendixFilters>({ q: '', kind: 'all' });
  /** Number of files currently being saved. */
  readonly uploading = signal(0);

  readonly totalSize = computed(() => this.appendices().reduce((sum, a) => sum + (a.size || 0), 0));

  readonly kindChips = computed<ChipOption[]>(() => {
    const list = this.appendices();
    return [
      { value: 'all', label: 'All', count: list.length },
      ...FILE_KINDS.map((k) => ({ value: k.value, label: k.label, count: list.filter((a) => a.kind === k.value).length }))
        .filter((chip) => chip.count > 0),
    ];
  });

  readonly visible = computed(() => {
    const { q, kind } = this.filters();
    return this.appendices()
      .filter((a) => kind === 'all' || a.kind === kind)
      .filter((a) => matchesSearch(q, a.name, kindInfo(a.kind).label))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  });

  constructor() {
    void this.removeOrphans();
  }

  setFilters(patch: Partial<AppendixFilters>): void {
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

  /** The stored file, or null when it is missing from this browser. */
  async file(appendix: Appendix): Promise<Blob | null> {
    try {
      return await this.files.get(appendix.id);
    } catch {
      return null;
    }
  }

  async remove(appendix: Appendix): Promise<void> {
    this.collection.remove(appendix.id);
    await this.files.delete(appendix.id).catch(() => undefined);
  }

  private async save(file: File): Promise<Appendix> {
    // If the bytes can't be stored, the record is removed again so the list never shows a broken file.
    const item = this.collection.add({ name: file.name, type: file.type, size: file.size, kind: kindOf(file.name, file.type) });
    try {
      await this.files.put(item.id, file);
      return item;
    } catch (error) {
      this.collection.remove(item.id);
      throw error;
    }
  }

  /** Drops stored files whose record was deleted (e.g. site data partly cleared). */
  private async removeOrphans(): Promise<void> {
    try {
      const stored = await this.files.keys();
      const known = new Set(this.appendices().map((a) => a.id));
      await Promise.all(stored.filter((id) => !known.has(id)).map((id) => this.files.delete(id)));
    } catch {
      /* storage unavailable: nothing to clean */
    }
  }
}
