import { FieldMap, field } from '../../../core/api/api-fields';
import { Entity } from '../../../core/models';
import { SelectOption, StatusTone } from '../../../shared/ui';
import type { Client } from '../clients/clients.model';

export type SalonStatus = 'lead' | 'trial' | 'active' | 'paused' | 'churned';
export type DeployStatus = 'not_deployed' | 'building' | 'live' | 'failed';
export type PlanCode = 'standard' | 'premium' | 'custom';

interface Labelled<V extends string> {
  value: V;
  label: string;
  tone: StatusTone;
}

export const SALON_STATUSES: readonly Labelled<SalonStatus>[] = [
  { value: 'lead', label: 'Lead', tone: 'neutral' },
  { value: 'trial', label: 'Trial', tone: 'info' },
  { value: 'active', label: 'Active', tone: 'ok' },
  { value: 'paused', label: 'Paused', tone: 'warn' },
  { value: 'churned', label: 'Churned', tone: 'bad' },
];

export const DEPLOY_STATUSES: readonly Labelled<DeployStatus>[] = [
  { value: 'not_deployed', label: 'Not deployed', tone: 'neutral' },
  { value: 'building', label: 'Building', tone: 'info' },
  { value: 'live', label: 'Live', tone: 'ok' },
  { value: 'failed', label: 'Failed', tone: 'bad' },
];

export const DNS_STATUSES: readonly Labelled<string>[] = [
  { value: 'pending', label: 'DNS pending', tone: 'neutral' },
  { value: 'configured', label: 'DNS configured', tone: 'info' },
  { value: 'verified', label: 'DNS verified', tone: 'ok' },
  { value: 'error', label: 'DNS error', tone: 'bad' },
];

export const SSL_STATUSES: readonly Labelled<string>[] = [
  { value: 'pending', label: 'SSL pending', tone: 'neutral' },
  { value: 'active', label: 'SSL active', tone: 'ok' },
  { value: 'expiring', label: 'SSL expiring', tone: 'warn' },
  { value: 'error', label: 'SSL error', tone: 'bad' },
];

export function labelOf<V extends string>(list: readonly Labelled<V>[], value: string): Labelled<V> {
  return list.find((x) => x.value === value) ?? list[0];
}

export const salonStatus = (s: string): Labelled<SalonStatus> => labelOf(SALON_STATUSES, s);

export const asOptions = (list: readonly { value: string; label: string }[]): SelectOption[] =>
  list.map(({ value, label }) => ({ value, label }));

/** One salon (tenant / booking site). Money in RON; timestamps are ISO strings or ''. */
export interface Salon extends Entity {
  clientId: string;
  name: string;
  tenantSlug: string;
  city: string;
  status: SalonStatus;
  planId: string;
  configVersion: string;
  configUrl: string;
  configUpdatedAt: string;
  deployStatus: DeployStatus;
  deployedAt: string;
  signedAt: string;
  goLiveOn: string;
  churnedOn: string;
  churnReason: string;
  leadId: string;
  referredBySalonId: string;
  uptimeMonitorId: string;
  notes: string;
  // from the server
  clientName: string;
  clientKind: string;
  clientEmail: string;
  clientPhone: string;
  clientAddressMissing: boolean;
  planCode: PlanCode | '';
  planName: string;
  primaryDomain: string;
}

export const SALON_FIELD_MAP: FieldMap<Salon> = {
  clientId: field.readOnly(field.ref()),
  name: field.text(),
  tenantSlug: field.ref(),
  city: field.text(),
  status: field.readOnly(field.text()),
  planId: field.ref(),
  configVersion: field.text(),
  configUrl: field.text(),
  configUpdatedAt: field.timestamp(),
  deployStatus: field.text(),
  deployedAt: field.timestamp(),
  signedAt: field.timestamp(),
  goLiveOn: field.date(),
  churnedOn: field.readOnly(field.date()),
  churnReason: field.readOnly(field.text()),
  leadId: field.readOnly(field.ref()),
  referredBySalonId: field.ref(),
  uptimeMonitorId: field.text(),
  notes: field.text(),
  clientName: field.readOnly(field.text()),
  clientKind: field.readOnly(field.text()),
  clientEmail: field.readOnly(field.text()),
  clientPhone: field.readOnly(field.text()),
  clientAddressMissing: field.readOnly(field.bool()),
  planCode: field.readOnly(field.text()),
  planName: field.readOnly(field.text()),
  primaryDomain: field.readOnly(field.text()),
};

export interface SalonDomain {
  id: string;
  salonId: string;
  domain: string;
  isPrimary: boolean;
  registrar: string;
  expiresOn: string | null;
  autoRenew: boolean;
  dnsStatus: string;
  sslStatus: string;
  sslExpiresOn: string | null;
  passwordManagerRef: string;
  notes: string;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: SalonStatus | null;
  toStatus: SalonStatus;
  changedOn: string;
  changedByName: string | null;
  reason: string;
}

export interface TimelineEntry {
  id: number | string;
  occurredAt: string;
  entityType: string;
  action: string;
  summary: string;
  userName: string | null;
}

/** GET /salons/:id/overview. Raw API rows (money in bani); later modules add their blocks. */
export interface SalonOverview {
  salon: Record<string, unknown>;
  client: Record<string, unknown>;
  domains: SalonDomain[];
  history: StatusHistoryEntry[];
  [block: string]: unknown;
}

export interface SalonFilters {
  q: string;
  /** A SalonStatus or 'all'. */
  status: string;
}

export interface Plan {
  id: string;
  code: PlanCode;
  name: string;
  /** RON */
  monthlyPrice: number;
  oneOffFrom: number;
  includedSessions: number;
  sessionMinutes: number;
  includesSms: boolean;
  minTermMonths: number;
  extraHourly: number;
  isActive: boolean;
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  freeMonths: number | null;
  discountPct: number | null;
  maxSalons: number | null;
  /** Salons whose subscription uses it. */
  used: number;
  isActive: boolean;
  notes: string;
}

export const planFromApi = (r: Record<string, unknown>): Plan => ({
  id: String(r['id']),
  code: r['code'] as PlanCode,
  name: String(r['name'] ?? ''),
  monthlyPrice: Number(r['monthlyPriceBani'] ?? 0) / 100,
  oneOffFrom: Number(r['oneOffFromBani'] ?? 0) / 100,
  includedSessions: Number(r['includedSessions'] ?? 0),
  sessionMinutes: Number(r['sessionMinutes'] ?? 30),
  includesSms: r['includesSms'] === true,
  minTermMonths: Number(r['minTermMonths'] ?? 0),
  extraHourly: Number(r['extraHourlyBani'] ?? 0) / 100,
  isActive: r['isActive'] !== false,
});

export const promotionFromApi = (r: Record<string, unknown>): Promotion => ({
  id: String(r['id']),
  code: String(r['code']),
  name: String(r['name'] ?? ''),
  freeMonths: r['freeMonths'] == null ? null : Number(r['freeMonths']),
  discountPct: r['discountPct'] == null ? null : Number(r['discountPct']),
  maxSalons: r['maxSalons'] == null ? null : Number(r['maxSalons']),
  used: Number(r['used'] ?? 0),
  isActive: r['isActive'] !== false,
  notes: String(r['notes'] ?? ''),
});

/** Client row of the overview → the app's Client shape (for the edit form). */
export const clientFromOverview = (r: Record<string, unknown>): Partial<Client> => ({
  id: String(r['id']),
  kind: (r['kind'] as Client['kind']) ?? 'company',
  name: String(r['name'] ?? ''),
  contactPerson: String(r['contactPerson'] ?? ''),
  email: String(r['email'] ?? ''),
  phone: String(r['phone'] ?? ''),
  businessAddress: String(r['businessAddress'] ?? ''),
  city: String(r['city'] ?? ''),
  billingEmail: String(r['billingEmail'] ?? ''),
  notes: String(r['notes'] ?? ''),
});

const ENTITY_LABELS: Record<string, string> = {
  salons: 'Salon',
  clients: 'Client',
  domains: 'Domain',
  leads: 'Lead',
  subscriptions: 'Subscription',
  payments: 'Payment',
  onboardings: 'Onboarding',
  'onboarding-steps': 'Onboarding step',
  tickets: 'Ticket',
  'time-entries': 'Time',
};

const ACTION_LABELS: Record<string, string> = {
  created: 'added',
  updated: 'edited',
  deleted: 'removed',
  status_changed: 'status changed',
};

/** "salons" + "status_changed" → "Salon · status changed". */
export function activityLabel(entry: Pick<TimelineEntry, 'entityType' | 'action'>): string {
  const what = ENTITY_LABELS[entry.entityType] ?? entry.entityType;
  const did = ACTION_LABELS[entry.action] ?? entry.action.replace(/_/g, ' ');
  return `${what} · ${did}`;
}
