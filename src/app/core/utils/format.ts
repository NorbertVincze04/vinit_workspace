/** Formatting and math helpers. Pure functions, no Angular. */

/** 6380 → "6.380" (Romanian grouping, matches the business plan). */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('ro-RO');
}

/** 6380 → "6.380 RON"; with `signed` → "+6.380 RON" / "−6.380 RON". */
export function formatRon(value: number, signed = false): string {
  let sign = value < 0 ? '−' : '';
  if (signed && value > 0) sign = '+';
  return `${sign}${formatNumber(Math.abs(value))} RON`;
}

/** 49.9, 'EUR' → "49,9 EUR" (up to 2 decimals, any currency). */
export function formatMoney(value: number, currency = 'RON'): string {
  return `${(Number(value) || 0).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} ${currency}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Whole-number percent, safe for an empty whole. */
export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
