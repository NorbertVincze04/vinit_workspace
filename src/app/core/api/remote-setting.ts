import { Injectable, WritableSignal, effect, inject, signal, untracked } from '@angular/core';
import { ToastService } from '../services/toast.service';
import { ApiService, apiError } from './api.service';
import { t } from '../i18n/i18n';

/** Loads the team settings once and shares them between every remoteSetting(). */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api = inject(ApiService);
  private values?: Promise<Record<string, unknown>>;

  load(): Promise<Record<string, unknown>> {
    this.values ??= this.api
      .get<{ values: Record<string, unknown> }>('/settings')
      .then((res) => res.values)
      .catch(() => {
        this.values = undefined;
        return {};
      });
    return this.values;
  }

  save(key: string, value: unknown): Promise<unknown> {
    return this.api.write('PUT', `/settings/${encodeURIComponent(key)}`, { value });
  }
}

/**
 * A signal backed by a team setting on the server (same use as persistedSignal()).
 * Starts with the fallback, switches to the saved value once loaded, and saves every change.
 * Must be called in an injection context.
 *
 *   readonly start = remoteSetting('plan.start', () => '2026-12', isMonthKey);
 */
export function remoteSetting<T>(
  key: string,
  fallback: () => T,
  validate?: (value: unknown) => value is T,
): WritableSignal<T> {
  const settings = inject(SettingsService);
  const toast = inject(ToastService);
  const state = signal<T>(fallback());
  let synced: string | null = null; // JSON of the value the server has; null until loaded

  void settings.load().then((values) => {
    const stored = values[key];
    const value = stored !== undefined && (!validate || validate(stored)) ? (stored as T) : state();
    synced = JSON.stringify(stored !== undefined ? value : null);
    state.set(value);
  });

  effect(
    () => {
      const value = state();
      if (synced === null) return; // not loaded yet: never overwrite the server with the fallback
      const json = JSON.stringify(value);
      if (json === synced) return;
      synced = json;
      // Saving updates the app's save-status signals, hence allowSignalWrites (and untracked).
      untracked(() =>
        settings.save(key, value).catch((error: unknown) => toast.show(t('Not saved: {error}', { error: apiError(error).message }), 6000)),
      );
    },
    { allowSignalWrites: true },
  );

  return state;
}
