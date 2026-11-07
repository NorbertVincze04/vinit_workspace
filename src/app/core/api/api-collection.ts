import { HttpErrorResponse } from '@angular/common/http';
import { Signal, inject, signal } from '@angular/core';
import { ToastService } from '../services/toast.service';
import { uid } from '../utils/id';
import { ApiService, apiError } from './api.service';
import { FieldMap, fromApi, toApi } from './api-fields';

/** A server-backed list of records. Same shape as persistedCollection(), plus loading state. */
export interface ApiCollection<T extends { id: string }> {
  readonly items: Signal<readonly T[]>;
  /** True once the list has been loaded successfully from the server. */
  readonly loaded: Signal<boolean>;
  get(id: string): T | undefined;
  /** Adds the record at once (with a new id) and saves it in the background. */
  add(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): T;
  update(id: string, patch: Partial<Omit<T, 'id'>>): void;
  remove(id: string): void;
  /**
   * Creates the record on the server first, then adds the server's row (with computed fields).
   * Use it when the server does more than store the data. Rejects (after a toast) on failure.
   */
  create(body: Record<string, unknown>): Promise<T>;
  /** Saves a change on the server and takes back the server's row. Rejects (after a toast) on failure. */
  save(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T>;
  /** Puts a row the server returned (from any endpoint) into the list, replacing the old copy. */
  upsertRow(row: Record<string, unknown>): T;
  /** Replaces everything (backup import, reset). Resolves when the server has it. */
  replaceAll(items: readonly T[]): Promise<void>;
  /** Changes the local copy only, to mirror something the server did by itself (e.g. unlinking). */
  setLocal(change: (items: readonly T[]) => readonly T[]): void;
  /** Loads the list again from the server. */
  reload(): Promise<void>;
}

/**
 * Server-backed collection. Must be called in an injection context (a store's field):
 *   readonly posts = apiCollection<Post>('/marketing/posts', POST_FIELDS, 'p');
 *   readonly salons = apiCollection<Salon>('/salons', SALON_FIELDS, uuid);
 *
 * Changes show up immediately (optimistic) and are written to the API in order. When a write
 * fails, a toast explains why and the list is reloaded from the server so it never lies.
 */
export function apiCollection<T extends { id: string }>(
  path: string,
  fields: FieldMap<T>,
  /** Prefix for the app's short ids ("t" → tlx3k9…), or a generator such as uuid for uuid tables. */
  newId: string | (() => string) = 'x',
): ApiCollection<T> {
  const makeId = typeof newId === 'function' ? newId : () => uid(newId);
  const api = inject(ApiService);
  const toast = inject(ToastService);
  const state = signal<readonly T[]>([]);
  const loaded = signal(false);

  const failed = (error: unknown): void => {
    toast.show(`Not saved: ${apiError(error).message}`, 6000);
    void reload();
  };

  const upsertRow = (row: Record<string, unknown>): T => {
    const item = fromApi<T>(fields, row);
    state.update((list) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]));
    return item;
  };

  const loudly = <R>(request: Promise<R>): Promise<R> =>
    request.catch((error: unknown) => {
      toast.show(`Not saved: ${apiError(error).message}`, 6000);
      throw error;
    });

  async function reload(): Promise<void> {
    try {
      const res = await api.get<{ items: Record<string, unknown>[] }>(path);
      state.set(res.items.map((row) => fromApi(fields, row)));
      // Only a successful load counts: an empty list after a failed load must never look like "no data".
      loaded.set(true);
    } catch (error) {
      // 401 is handled by the interceptor (back to sign-in).
      if (!(error instanceof HttpErrorResponse && error.status === 401)) {
        toast.show(`Could not load data: ${apiError(error).message}`, 6000);
      }
    }
  }

  void reload();

  return {
    items: state.asReadonly(),
    loaded: loaded.asReadonly(),
    get: (id) => state().find((x) => x.id === id),

    add(data) {
      const now = new Date().toISOString();
      const item = { ...data, id: data.id || makeId(), createdAt: now, updatedAt: now } as unknown as T;
      state.update((list) => [...list, item]);
      api.write<{ item: Record<string, unknown> }>('POST', path, { ...toApi(fields, item), id: item.id }).then(
        (res) => {
          // Take the server's timestamps; keep any edits made while the request was in flight.
          const saved = fromApi<T>(fields, res.item) as T & { createdAt?: string };
          state.update((list) => list.map((x) => (x.id === item.id ? ({ ...x, createdAt: saved.createdAt } as T) : x)));
        },
        (error) => failed(error),
      );
      return item;
    },

    update(id, patch) {
      const now = new Date().toISOString();
      state.update((list) => list.map((x) => (x.id === id ? ({ ...x, ...patch, updatedAt: now } as T) : x)));
      const body = toApi(fields, patch as Partial<T>);
      if (!Object.keys(body).length) return;
      api.write('PATCH', `${path}/${encodeURIComponent(id)}`, body).catch(failed);
    },

    remove(id) {
      state.update((list) => list.filter((x) => x.id !== id));
      api.write('DELETE', `${path}/${encodeURIComponent(id)}`).catch((error: unknown) => {
        if (!(error instanceof HttpErrorResponse && error.status === 404)) failed(error);
      });
    },

    async create(body) {
      const res = await loudly(api.write<{ item: Record<string, unknown> }>('POST', path, body));
      return upsertRow(res.item);
    },

    async save(id, patch) {
      const res = await loudly(
        api.write<{ item: Record<string, unknown> }>('PATCH', `${path}/${encodeURIComponent(id)}`, toApi(fields, patch as Partial<T>)),
      );
      return upsertRow(res.item);
    },

    upsertRow,

    async replaceAll(items) {
      state.set([...items]);
      try {
        const res = await api.write<{ items: Record<string, unknown>[] }>('PUT', path, {
          items: items.map((x) => toApi(fields, x, { meta: true })),
        });
        state.set(res.items.map((row) => fromApi(fields, row)));
      } catch (error) {
        failed(error);
        throw error;
      }
    },

    setLocal(change) {
      state.update(change);
    },

    reload,
  };
}
