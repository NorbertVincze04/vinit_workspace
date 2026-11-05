import { FINANCE } from '../../../core/data/finance.data';
import { Entity } from '../../../core/models';
import { StatusTone } from '../../../shared/ui';

export type ClientPlan = 'standard' | 'premium' | 'custom';
export type ClientStatus = 'lead' | 'demo' | 'beta' | 'active' | 'paused';
export type ClientSort = 'newest' | 'name';

/** A salon in the pipeline or on the platform. */
export interface Client extends Entity {
  salon: string;
  owner: string;
  city: string;
  phone: string;
  email: string;
  domain: string;
  plan: ClientPlan;
  /** Monthly price in RON; counts toward MRR while the client is Active. */
  price: number;
  status: ClientStatus;
  /** "YYYY-MM-DD" */
  since: string;
  notes: string;
}

export const CLIENT_PLANS: Readonly<Record<ClientPlan, { label: string; price: number }>> = {
  standard: { label: 'Standard Barbershop', price: FINANCE.standardPrice },
  premium: { label: 'Premium Brand', price: FINANCE.premiumPrice },
  custom: { label: 'Custom', price: 0 },
};

export const CLIENT_STATUSES: readonly { value: ClientStatus; label: string; tone: StatusTone }[] = [
  { value: 'lead', label: 'Lead', tone: 'neutral' },
  { value: 'demo', label: 'Demo booked', tone: 'info' },
  { value: 'beta', label: 'Beta (free)', tone: 'warn' },
  { value: 'active', label: 'Active', tone: 'ok' },
  { value: 'paused', label: 'Paused', tone: 'bad' },
];

export interface ClientFilters {
  q: string;
  /** A ClientStatus or 'all'. */
  status: string;
  sort: ClientSort;
}

export function statusInfo(status: ClientStatus): { label: string; tone: StatusTone } {
  return CLIENT_STATUSES.find((s) => s.value === status) ?? CLIENT_STATUSES[0];
}

/** "https://Salon.ro/" → "Salon.ro"; null when it is not a valid domain. */
export function cleanDomain(domain: string): string | null {
  const v = String(domain || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(v) ? v : null;
}
