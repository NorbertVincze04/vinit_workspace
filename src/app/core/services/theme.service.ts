import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { persistedSignal } from '../utils/persisted-signal';

export type ThemePreference = 'system' | 'light' | 'dark';

const isPreference = (v: unknown): v is ThemePreference =>
  v === 'system' || v === 'light' || v === 'dark';

/** Light/dark theme. Follows the OS until the user toggles it; the choice is remembered. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly preference = persistedSignal<ThemePreference>('theme', () => 'system', {
    validate: isPreference,
  });

  readonly effective = computed<'light' | 'dark'>(() => {
    const pref = this.preference();
    if (pref !== 'system') return pref;
    return this.systemDark() ? 'dark' : 'light';
  });

  constructor() {
    this.media?.addEventListener('change', (e) => this.systemDark.set(e.matches));

    effect(() => {
      const pref = this.preference();
      const root = this.document.documentElement;
      if (pref === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', pref);
    });
  }

  toggle(): void {
    this.preference.set(this.effective() === 'dark' ? 'light' : 'dark');
  }
}
