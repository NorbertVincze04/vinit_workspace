import { normalize } from '../../../core/utils/text';

/** One lead row for POST /leads/import (API field names). */
export type ImportRow = Record<string, string | number>;

/**
 * Which spreadsheet column fills which lead field. Matches the prospect list (Clients.xlsm:
 * Business Name, Email, Phone, Employees, Service, Billing, Notes, Status, Website, Location,
 * Social media) and common Romanian headers.
 */
const COLUMNS: Record<string, readonly string[]> = {
  businessName: ['business name', 'business', 'name', 'salon', 'nume', 'denumire', 'firma'],
  contactName: ['contact', 'contact name', 'contact person', 'owner', 'persoana de contact', 'proprietar'],
  email: ['email', 'e-mail', 'mail'],
  phone: ['phone', 'telefon', 'tel', 'mobile', 'mobil'],
  employees: ['employees', 'staff', 'barbers', 'angajati', 'frizeri'],
  services: ['service', 'services', 'servicii', 'serviciu'],
  website: ['website', 'site', 'web'],
  city: ['location', 'city', 'oras', 'localitate', 'locatie'],
  instagram: ['social media', 'instagram', 'social', 'facebook'],
  notes: ['notes', 'note', 'notite', 'observatii'],
};
/** Columns without their own field: kept in the notes as "Billing: …". */
const EXTRA_NOTES = ['billing', 'status', 'facturare'];

export interface ImportPreview {
  rows: ImportRow[];
  /** Header → field it was read into ('' = ignored). */
  mapping: { header: string; field: string }[];
  /** Rows dropped because they had no business name. */
  withoutName: number;
}

export function leadsFromTable(table: readonly string[][]): ImportPreview {
  const [head = [], ...body] = table;
  const fields = head.map((h) => {
    const key = normalize(h).trim();
    const field = Object.entries(COLUMNS).find(([, names]) => names.includes(key))?.[0];
    return field ?? (EXTRA_NOTES.includes(key) ? `note:${h.trim()}` : '');
  });
  // The first matching column wins (e.g. "Social media" before "Facebook").
  const seen = new Set<string>();
  const used = fields.map((f) => (f && !f.startsWith('note:') && seen.has(f) ? '' : (seen.add(f), f)));

  const rows: ImportRow[] = [];
  let withoutName = 0;
  for (const cells of body) {
    const row: ImportRow = {};
    const notes: string[] = [];
    used.forEach((field, i) => {
      const value = (cells[i] ?? '').trim();
      if (!field || !value) return;
      if (field.startsWith('note:')) notes.push(`${field.slice(5)}: ${value}`);
      else if (field === 'employees') {
        const n = parseInt(value, 10);
        if (Number.isFinite(n) && n >= 0 && n <= 10_000) row['employees'] = n;
      } else if (field === 'email') {
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) row['email'] = value.slice(0, 200);
        else notes.push(`Email: ${value}`);
      } else row[field] = value.slice(0, field === 'notes' ? 20_000 : field === 'services' ? 2000 : 200);
    });
    if (notes.length) row['notes'] = [row['notes'], ...notes].filter(Boolean).join('\n');
    if (!row['businessName']) {
      withoutName++;
      continue;
    }
    row['source'] = 'other';
    rows.push(row);
  }
  return { rows, mapping: head.map((header, i) => ({ header, field: used[i].startsWith('note:') ? 'notes' : used[i] })), withoutName };
}
