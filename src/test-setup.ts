/**
 * Unit tests run in English (the texts the specs check); the Romanian side is tested in
 * core/i18n/i18n.spec.ts. Loaded as a test polyfill, so before any app code reads the language.
 */
try {
  localStorage.setItem('vinit.lang', 'en');
} catch {
  /* storage blocked: the app falls back to Romanian and the specs say so */
}
