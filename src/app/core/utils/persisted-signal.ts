import { WritableSignal, effect, inject, signal } from '@angular/core';
import { StorageService } from '../services/storage.service';

export interface PersistOptions<T> {
  /** Rejects stored data with the wrong shape (falls back to the default instead). */
  validate?: (value: unknown) => value is T;
}

/**
 * A signal that loads from localStorage once and saves on every change.
 * Must be called in an injection context (a service/component field or constructor).
 *
 *   readonly state = persistedSignal('roadmap.v1', () => ({ done: {}, salons: 0 }));
 */
export function persistedSignal<T>(
  key: string,
  fallback: () => T,
  options: PersistOptions<T> = {},
): WritableSignal<T> {
  const storage = inject(StorageService);
  const stored = storage.read(key);
  const isValid = stored !== null && (!options.validate || options.validate(stored));
  const state = signal<T>(isValid ? (stored as T) : fallback());

  effect(() => storage.write(key, state()), { allowSignalWrites: true });

  return state;
}
