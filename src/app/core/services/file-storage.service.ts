import { Injectable } from '@angular/core';

const DB_NAME = 'vinit-files';
const STORE = 'files';

/**
 * Binary file storage in the browser's IndexedDB (localStorage is too small for PDFs and decks).
 * Files are keyed by the id of the record that describes them.
 * Swap this class for an API-backed one (e.g. object storage) to share files between devices.
 */
@Injectable({ providedIn: 'root' })
export class FileStorageService {
  private db?: Promise<IDBDatabase>;

  async put(id: string, blob: Blob): Promise<void> {
    await this.run('readwrite', (store) => store.put(blob, id));
    // Ask the browser not to evict stored files when space runs low (best effort).
    navigator.storage?.persist?.().catch(() => undefined);
  }

  async get(id: string): Promise<Blob | null> {
    const value = await this.run<unknown>('readonly', (store) => store.get(id));
    return value instanceof Blob ? value : null;
  }

  async delete(id: string): Promise<void> {
    await this.run('readwrite', (store) => store.delete(id));
  }

  async keys(): Promise<string[]> {
    const keys = await this.run<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
    return keys.map(String);
  }

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      this.db = undefined; // allow a retry later
      throw error;
    });
    return this.db;
  }

  private async run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result as T);
      tx.onerror = () => reject(tx.error ?? request.error);
      tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
    });
  }
}
