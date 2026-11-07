/** Date helpers working with ISO strings ("2026-12-05") and month keys ("2026-12"). Pure functions. */

export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const MONTH_KEY = /^\d{4}-\d{2}$/;

export function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && MONTH_KEY.test(value);
}

/** Today as "YYYY-MM-DD" in local time. */
export function todayISO(): string {
  return new Date().toLocaleDateString('sv-SE');
}

/** "2026-12-05" → "5 Dec 2026" (or custom Intl options). Empty string for invalid input. */
export function formatDate(iso: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', options ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "2026-12" → "December 2026", or "Dec" when short. */
export function monthName(monthKey: string, short = false): string {
  const d = new Date(`${monthKey}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', short ? { month: 'short' } : { month: 'long', year: 'numeric' });
}

/** Moves a month key by n months: shiftMonth("2026-12", 1) → "2027-01". */
export function shiftMonth(monthKey: string, n: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Next occurrence of a repeating date; keeps the day of month where possible. */
export function addPeriod(iso: string, frequency: Frequency): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString('sv-SE');
  }
  const months = frequency === 'quarterly' ? 3 : frequency === 'yearly' ? 12 : 1;
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return target.toLocaleDateString('sv-SE');
}

/** Whole days from today to the date (negative when in the past). */
export function daysUntil(iso: string): number {
  const today = new Date(`${todayISO()}T00:00:00`).getTime();
  const target = new Date(`${iso}T00:00:00`).getTime();
  return Math.round((target - today) / 86_400_000);
}

/** ISO instant → "YYYY-MM-DDTHH:mm" in local time (value of an <input type="datetime-local">). */
export function toLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('sv-SE')}T${d.toTimeString().slice(0, 5)}`;
}

/** "YYYY-MM-DDTHH:mm" in local time → ISO instant; '' when empty or invalid. */
export function fromLocalDateTime(local: string | null | undefined): string {
  if (!local) return '';
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** ISO instant → "5 Dec 2026, 14:30". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Whole hours between two instants (b defaults to now). */
export function hoursBetween(a: string, b?: string): number {
  return Math.floor(((b ? new Date(b) : new Date()).getTime() - new Date(a).getTime()) / 3_600_000);
}
