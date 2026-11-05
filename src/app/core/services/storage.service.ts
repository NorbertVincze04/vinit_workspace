import { Injectable, signal } from '@angular/core';

/**
 * Thin, safe wrapper around localStorage. Every key is namespaced with "vinit.".
 * Reads/writes never throw (private mode, blocked storage, full quota).
 * Swap this class for an API-backed one later without touching the features.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly prefix = 'vinit.';

  /** True when the last write failed — shown to the user by <app-save-status>. */
  readonly writeFailed = signal(false);

  read(key: string): unknown {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  }

  write(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
      this.writeFailed.set(false);
      return true;
    } catch {
      this.writeFailed.set(true);
      return false;
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch {
      /* storage unavailable: nothing to remove */
    }
  }
}
