import { isDevMode } from '@angular/core';
import { RO } from './ro';

/**
 * Two languages: Romanian (default) and English. The English text is the key: t('New deadline')
 * returns it as is in English and its Romanian translation in Romanian. The language is read once at
 * start-up and changing it reloads the app, so every label (even ones built when a file loads) follows.
 *
 *   t('Saved')                          → "Salvat"
 *   t('Year {n} added', { n: 2 })       → "Anul 2 a fost adăugat"
 *   countOf(3, 'day', 'days')           → "3 zile" / "20 de zile" / "1 zi"
 */
export type Lang = 'ro' | 'en';

const STORAGE_KEY = 'vinit.lang';

function readLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ro') return stored;
  } catch {
    /* storage blocked: default */
  }
  return 'ro';
}

let current: Lang = readLang();
if (typeof document !== 'undefined') document.documentElement.lang = current;

/** The app's language. */
export const lang = (): Lang => current;

/** Locale for Intl (dates, months). */
export const locale = (): string => (current === 'ro' ? 'ro-RO' : 'en-GB');

/** Saves the language and reloads the app in it. */
export function setLang(next: Lang, reload = true): void {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage blocked: only this session */
  }
  current = next;
  document.documentElement.lang = next;
  if (reload) location.reload();
}

const missing = new Set<string>();

/** Translates an English UI text; {name} placeholders are filled from params. */
export function t(text: string, params?: Record<string, string | number>): string {
  let out = text;
  if (current === 'ro' && text) {
    const ro = RO[text];
    if (ro !== undefined) out = ro;
    else if (isDevMode() && !missing.has(text)) {
      missing.add(text);
      console.debug('[i18n] missing ro:', JSON.stringify(text));
    }
  }
  return params ? out.replace(/\{(\w+)\}/g, (m, key: string) => (key in params ? String(params[key]) : m)) : out;
}

const rules = new Map<string, Intl.PluralRules>();

/**
 * "1 day", "3 days" in English; "1 zi", "3 zile", "20 de zile" in Romanian (Romanian adds "de"
 * from 20 on). The words are English keys of the dictionary.
 */
export function countOf(n: number, one: string, other: string): string {
  if (current === 'en') return `${n} ${n === 1 ? one : other}`;
  const pr = rules.get('ro') ?? new Intl.PluralRules('ro-RO');
  rules.set('ro', pr);
  const kind = pr.select(n);
  if (kind === 'one') return `${n} ${t(one)}`;
  return kind === 'few' ? `${n} ${t(other)}` : `${n} de ${t(other)}`;
}

/** Texts that weren't found in the dictionary this session (development aid). */
export const missingTranslations = (): string[] => [...missing];
