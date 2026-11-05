/** Lower-case and strip diacritics, so "Brașov" matches "brasov" in searches. */
export function normalize(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** True when every word of the query appears somewhere in the given fields. */
export function matchesSearch(query: string, ...fields: unknown[]): boolean {
  const q = normalize(query).trim();
  if (!q) return true;
  return normalize(fields.join(' ')).includes(q);
}

/** Parses "1250", "1 250" or "49,99" → number; null when empty, NaN when invalid. */
export function parseAmount(value: unknown): number | null {
  const text = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.');
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : NaN;
}
