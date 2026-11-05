import { SelectOption } from '../form-field/field.types';

/**
 * Field definitions drive <app-form-dialog>: describe the fields once, the dialog renders,
 * validates and returns typed-ish values. Used by Clients, Marketing and Finances.
 */

export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'date'
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
  required?: boolean;
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
  integer?: boolean;
  // check fields
  checkLabel?: string;
}

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
