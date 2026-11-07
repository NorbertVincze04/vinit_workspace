import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export const API_BASE = '/api/v1';

export type WriteMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** The API's error body: { error: { code, message, fields? } }. */
export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export function apiError(error: unknown): ApiErrorBody {
  if (error instanceof HttpErrorResponse) {
    const body = (error.error as { error?: ApiErrorBody } | null)?.error;
    if (body?.message) return body;
    if (error.status === 0) return { code: 'offline', message: 'The VINIT server cannot be reached. Is it running?' };
    return { code: 'http_' + error.status, message: `The server answered ${error.status}.` };
  }
  return { code: 'unknown', message: 'Something went wrong.' };
}

/**
 * Talks to the VINIT API. Reads run immediately; writes run one after another in the order
 * they were made, so a quick "add then edit" never reaches the server out of order.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private queue: Promise<unknown> = Promise.resolve();

  /** Writes waiting for or in flight to the server. */
  readonly pending = signal(0);
  /** Message of the last failed write, cleared by the next successful one. */
  readonly lastError = signal<string | null>(null);
  readonly status = computed<'saving' | 'saved' | 'failed'>(() =>
    this.pending() > 0 ? 'saving' : this.lastError() ? 'failed' : 'saved',
  );

  get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
    return firstValueFrom(this.http.get<T>(API_BASE + path, { params }));
  }

  getBlob(path: string): Promise<Blob> {
    return firstValueFrom(this.http.get(API_BASE + path, { responseType: 'blob' }));
  }

  write<T = unknown>(method: WriteMethod, path: string, body?: unknown): Promise<T> {
    this.pending.update((n) => n + 1);
    const run = (): Promise<T> => firstValueFrom(this.http.request<T>(method, API_BASE + path, { body }));
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    result.then(
      () => this.lastError.set(null),
      (error: unknown) => this.lastError.set(apiError(error).message),
    );
    void result.catch(() => undefined).finally(() => this.pending.update((n) => n - 1));
    return result;
  }

  /** Resolves once every queued write has finished. */
  settled(): Promise<void> {
    return this.queue.then(() => undefined);
  }
}
