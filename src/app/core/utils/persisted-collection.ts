import { Signal } from '@angular/core';
import { Entity, EntityData } from '../models';
import { uid } from './id';
import { persistedSignal } from './persisted-signal';

/** A saved list of records with create / update / delete. See persistedCollection(). */
export interface PersistedCollection<T extends Entity> {
  readonly items: Signal<readonly T[]>;
  get(id: string): T | undefined;
  add(data: EntityData<T>): T;
  update(id: string, patch: Partial<EntityData<T>>): void;
  remove(id: string): void;
  /** Replaces everything (used by backup import and reset). */
  replaceAll(items: readonly T[]): void;
}

/**
 * localStorage-backed collection. Must be called in an injection context (a store's field).
 *   readonly clients = persistedCollection<Client>('clients.v1', 'c');
 */
export function persistedCollection<T extends Entity>(key: string, idPrefix = 'x'): PersistedCollection<T> {
  const state = persistedSignal<readonly T[]>(key, () => [], {
    validate: (v): v is readonly T[] => Array.isArray(v),
  });

  return {
    items: state.asReadonly(),
    get: (id) => state().find((x) => x.id === id),
    add(data) {
      const now = new Date().toISOString();
      const item = { ...data, id: uid(idPrefix), createdAt: now, updatedAt: now } as unknown as T;
      state.update((list) => [...list, item]);
      return item;
    },
    update(id, patch) {
      const now = new Date().toISOString();
      state.update((list) => list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now } : x)));
    },
    remove(id) {
      state.update((list) => list.filter((x) => x.id !== id));
    },
    replaceAll(items) {
      state.set([...items]);
    },
  };
}
