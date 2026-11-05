/** Browser file helpers for backups (export / import) and CSV exports. */

export function downloadJson(data: unknown, filename: string): void {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}

/** Downloads rows as CSV (with a BOM so Excel reads diacritics correctly). */
export function downloadCsv(rows: readonly (readonly unknown[])[], filename: string): void {
  const escape = (v: unknown): string => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = rows.map((r) => r.map(escape).join(',')).join('\n');
  downloadBlob(new Blob([`﻿${text}`], { type: 'text/csv' }), filename);
}

/** Reads a user-picked file as JSON. Rejects if it is not valid JSON. */
export async function readJsonFile(file: File): Promise<unknown> {
  return JSON.parse(await file.text());
}

/** Saves any blob (an uploaded file, a generated export) to the user's device. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Large files on slower phones need the URL a little longer before it is released.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
