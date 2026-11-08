import { FieldMap, field } from '../../../core/api/api-fields';
import { Entity } from '../../../core/models';
import { SelectOption } from '../../../shared/ui';
import type { SalonStatus } from '../salons/salons.model';

export type ClientKind = 'person' | 'company';

/** The person or company that pays. Has at most one salon. */
export interface Client extends Entity {
  kind: ClientKind;
  /** The payer's name: the person, or the company. */
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  /** '' only for records moved from the old browser Clients tool (they never had one). */
  businessAddress: string;
  city: string;
  billingEmail: string;
  notes: string;
  // from the server
  salonId: string;
  salonName: string;
  salonStatus: SalonStatus | '';
}

export const CLIENT_KINDS: readonly SelectOption[] = [
  { value: 'company', label: 'Company' },
  { value: 'person', label: 'Private person' },
];

export const CLIENT_FIELD_MAP: FieldMap<Client> = {
  kind: field.text(),
  name: field.text(),
  contactPerson: field.text(),
  email: field.text(),
  phone: field.text(),
  businessAddress: field.text(),
  city: field.text(),
  billingEmail: field.text(),
  notes: field.text(),
  salonId: field.readOnly(field.ref()),
  salonName: field.readOnly(field.text()),
  salonStatus: field.readOnly(field.text()),
};

export interface ClientFilters {
  q: string;
  /** 'all' | 'with-salon' | 'without-salon' | 'missing-address' */
  show: string;
}

/** "https://Salon.ro/" → "salon.ro"; null when it is not a valid domain. */
export function cleanDomain(domain: string): string | null {
  const v = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(v) ? v : null;
}
