import { z } from 'zod';

/** Reusable field schemas. Every API body goes through one of these (see resource.ts). */

/** Record id: the app's own short ids ("g1", "tlx3k9a2f1q") or uuids. */
export const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'Invalid id.');
/** Optional link to another record (null = none). */
export const ref = id.nullable();

export const text = (max = 2000) => z.string().max(max, `Use at most ${max} characters.`);
export const longText = text(20_000);

/** Money in bani (1 RON = 100 bani). Whole numbers only, so there are no rounding errors. */
const MAX_BANI = 2_000_000_000; // ±20 million RON, the integer column's safe range
export const bani = z.number().int('Money is stored in whole bani.').min(-MAX_BANI).max(MAX_BANI);
export const positiveBani = bani.min(0, 'Must be zero or more.');

export const currency = z.enum(['RON', 'EUR', 'USD']);

/** Calendar day "YYYY-MM-DD" that really exists (no 2026-02-30). */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'This date does not exist.');
export const optionalDate = isoDate.nullable();

/** "YYYY-MM" */
export const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use the format YYYY-MM.');

/** ISO timestamp, used only to keep the original creation time when importing. */
export const timestamp = z.iso.datetime({ offset: true });

/** uuid of a record in the Phase 2+ tables (salons, clients, leads…). */
export const uuid = z.uuid('Invalid id.');
export const uuidRef = uuid.nullable();

/** Empty, or a valid e-mail address. */
export const optionalEmail = z.union([z.literal(''), z.email('Enter a valid e-mail address.').max(200)]);
export const phone = text(40);

/** A moment in time (ISO with offset), or null. */
export const optionalTimestamp = timestamp.nullable();

/** "https://Salon.RO/" → "salon.ro". */
export const domainName = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^https?:\/\//, '').replace(/\/+$/, ''))
  .pipe(
    z
      .string()
      .max(253)
      .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, 'Enter a domain like salonname.ro.'),
  );

/** Tenant slug of the booking product (shops.slug): "barber-house". */
export const slug = z
  .string()
  .max(63)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lower-case letters, digits and single dashes.');

/** Validated route parameter ":id" for uuid tables. */
export const uuidParams = z.object({ id: uuid });
