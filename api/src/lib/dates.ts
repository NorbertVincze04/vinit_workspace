/** Calendar-day helpers on "YYYY-MM-DD" strings (UTC arithmetic, so no timezone shifts). */

const toDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date): string => d.toISOString().slice(0, 10);

/** Today in Bucharest. */
export function today(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Bucharest' });
}

export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** Same day n months later, clamped to the month's last day (31 Jan + 1 month → 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const d = toDate(iso);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return toIso(target);
}

/** "2027-02" → "2027-02-28". */
export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return toIso(new Date(Date.UTC(y, m, 0)));
}

/** "2027-02" → "2027-02-01". */
export const monthStart = (month: string): string => `${month}-01`;

/** "2027-02-14" → "2027-02". */
export const monthOf = (iso: string): string => iso.slice(0, 7);

/** Months from a to b ("2027-01" → "2027-03" = 2). */
export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

/** Every month key from `from` to `to`, inclusive. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let i = 0; i <= monthsBetween(from, to) && i < 240; i++) out.push(monthOf(addMonths(monthStart(from), i)));
  return out;
}
