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

/**
 * Parses CSV text (as saved by Excel: "," or ";" separated, quoted fields, BOM) into rows of cells.
 * The separator is picked from the first line.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
