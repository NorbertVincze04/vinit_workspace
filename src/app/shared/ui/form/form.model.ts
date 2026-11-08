import { SelectOption } from '../form-field/field.types';

/**
 * Field definitions drive <app-form-dialog>: describe the fields once, the dialog renders,
 * validates and returns typed-ish values. Used by Clients, Marketing and Finances.
 */

export type FieldType =
  | 'text'
  | 'email'
  /** Phone number (checked: 0740 123 456, +40 740 123 456…). */
  | 'tel'
  /** Web link (checked: a full http(s) address). */
  | 'url'
  | 'date'
  /** Date and time in local time, "YYYY-MM-DDTHH:mm" (convert with fromLocalDateTime()). */
  | 'datetime'
  /** Time of day, "HH:MM". */
  | 'time'
  | 'textarea'
  /** Whole or decimal number typed as text ("1250", "49,99"). */
  | 'number'
  | 'select'
  /** Segmented buttons for 2–4 options. */
  | 'switch'
  /** Single checkbox (boolean). */
  | 'check'
  /** Several checkboxes (string[]). */
  | 'multi';

export type FormValue = string | number | boolean | readonly string[];
export type FormValues = Record<string, FormValue>;

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** true, or a rule on the other values (e.g. a reason only when the status is churned). */
  required?: boolean | ((values: FormValues) => boolean);
  /** Grid columns to span (the dialog has 2 or 4 columns). */
  span?: 1 | 2 | 3 | 4 | 'full';
  placeholder?: string;
  hint?: string;
  options?: readonly SelectOption[] | ((values: FormValues) => readonly SelectOption[]);
  /** Hide the field depending on other values. Hidden fields save as ''. */
  show?: (values: FormValues) => boolean;
  default?: FormValue | (() => FormValue);
  /** Return other values to update when this field changes (e.g. package → price). */
  onChange?: (values: FormValues) => Partial<FormValues>;
  // number fields
  allowNegative?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  // check fields
  checkLabel?: string;
  // text fields (email fields are checked for a valid address automatically)
  maxLength?: number;
  minLength?: number;
  /**
   * Extra rule for a non-empty text value: return an error message (English; the dialog translates
   * it), or null when it is fine. See the validators below.
   */
  validate?: (value: string, values: FormValues) => string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (value: string): boolean => EMAIL.test(value);

/** 7–15 digits, optional leading +, spaces, dots, dashes and brackets: 0740 123 456, +40 (740) 123-456. */
export const isPhone = (value: string): boolean => {
  if (!/^\+?[\d\s().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= 7 && digits <= 15;
};

/** A full http(s) link the browser can open. */
export const isUrl = (value: string): boolean => {
  if (!/^https?:\/\/\S+\.\S+$/i.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

// ---- rules for FieldDef.validate (messages are English keys, translated by the dialog) ----

/** "salon.ro", "www.my-salon.com" (https:// and a trailing / are tolerated). */
export const validDomain = (v: string): string | null =>
  /^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i.test(v.replace(/^https?:\/\//i, '').replace(/\/+$/, '')) ? null : 'Enter a domain like salonname.ro.';

/** IBAN with a correct check (mod 97); a Romanian one has 24 characters. Spaces allowed. */
export const validIban = (v: string): string | null => {
  const iban = v.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return 'Enter a valid IBAN, like RO49 AAAA 1B31 0075 9384 0000.';
  if (iban.startsWith('RO') && iban.length !== 24) return 'A Romanian IBAN has 24 characters.';
  const moved = iban.slice(4) + iban.slice(0, 4);
  const digits = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1 ? null : 'This IBAN has a typo: its check digits don’t match.';
};

/** Romanian company tax code (CUI/CIF), with or without "RO": 2–10 digits with a valid check digit. */
export const validCui = (v: string): string | null => {
  const cui = v.replace(/^RO/i, '').replace(/\s+/g, '');
  if (!/^\d{2,10}$/.test(cui)) return 'Enter a CUI like RO12345678 or 12345678.';
  const digits = cui.split('').map(Number);
  const check = digits.pop()!;
  const key = [7, 5, 3, 2, 1, 7, 5, 3, 2].slice(9 - digits.length);
  const sum = digits.reduce((acc, d, i) => acc + d * key[i], 0);
  return ((sum * 10) % 11) % 10 === check ? null : 'This CUI has a typo: its check digit doesn’t match.';
};

/** "@barberclub" or the profile link. */
export const validInstagram = (v: string): string | null =>
  /^@?[A-Za-z0-9._]{1,30}$/.test(v) || /^https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?$/i.test(v)
    ? null
    : 'Enter an Instagram handle like @barberclub, or the profile link.';

/** "barberclub.ro" or a full link. */
export const validWebsite = (v: string): string | null =>
  isUrl(v) || validDomain(v) === null ? null : 'Enter a website like barberclub.ro or https://barberclub.ro.';

/** Romanian postal code: 6 digits. */
export const validPostalCode = (v: string): string | null => (/^\d{6}$/.test(v.trim()) ? null : 'A postal code has 6 digits, like 400001.');

/** A date on or after another field's date (an end after its start). */
export const notBefore =
  (otherKey: string, message: string) =>
  (v: string, values: FormValues): string | null => {
    const other = values[otherKey];
    return typeof other === 'string' && other && v < other ? message : null;
  };

// ---- helpers to read form values back into entity fields ----

export function asString(value: FormValue | undefined): string {
  return typeof value === 'string' ? value : value === undefined ? '' : String(value);
}

export function asNumber(value: FormValue | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function asBoolean(value: FormValue | undefined): boolean {
  return value === true || value === 'true';
}

export function asList(value: FormValue | undefined): string[] {
  return Array.isArray(value) ? [...value] : [];
}

/** Turns an entity into initial form values (drops null/undefined and nested objects). */
export function toFormValues(source: object | null | undefined): FormValues {
  const out: FormValues = {};
  if (!source) return out;
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out[key] = value;
    else if (Array.isArray(value)) out[key] = value.map(String);
  }
  return out;
}
