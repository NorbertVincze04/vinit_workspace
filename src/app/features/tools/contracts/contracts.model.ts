import { todayISO } from '../../../core/utils/date';
import { FieldDef, FormValues, SelectOption, StatusTone, asBoolean, asString, notBefore } from '../../../shared/ui';
import { Attachment } from './components/attachments/attachments.component';
import { t } from '../../../core/i18n/i18n';

export type ContractKind = 'subscription' | 'custom_project' | 'dpa' | 'addendum';
export type ContractStatus = 'draft' | 'sent' | 'signed' | 'expired' | 'terminated';

export const CONTRACT_KINDS: readonly { value: ContractKind; label: string }[] = [
  { value: 'subscription', label: 'Subscription contract' },
  { value: 'dpa', label: 'DPA (GDPR data processing)' },
  { value: 'custom_project', label: 'Custom project' },
  { value: 'addendum', label: 'Addendum' },
];

export const CONTRACT_STATUSES: readonly { value: ContractStatus; label: string; tone: StatusTone }[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'sent', label: 'Sent', tone: 'info' },
  { value: 'signed', label: 'Signed', tone: 'ok' },
  { value: 'expired', label: 'Expired', tone: 'warn' },
  { value: 'terminated', label: 'Terminated', tone: 'bad' },
];

export const kindLabel = (k: string): string => t(CONTRACT_KINDS.find((x) => x.value === k)?.label ?? k);
export const contractStatus = (s: string) => CONTRACT_STATUSES.find((x) => x.value === s) ?? CONTRACT_STATUSES[0];

/** API row of GET /contracts. */
export interface Contract {
  id: string;
  salonId: string;
  salonName: string;
  clientName: string | null;
  kind: ContractKind;
  number: string;
  status: ContractStatus;
  signedOn: string | null;
  startsOn: string | null;
  endsOn: string | null;
  renewalOn: string | null;
  autoRenew: boolean;
  notes: string;
  files: number;
}

export interface ComplianceRow {
  salonId: string;
  salonName: string;
  salonStatus: string;
  contractSignedOn: string | null;
  dpaSignedOn: string | null;
  renewalOn: string | null;
}

/** GET /salons/:id/overview → contracts */
export interface SalonContracts {
  contracts: Contract[];
  files: Attachment[];
  contractSignedOn: string | null;
  dpaSignedOn: string | null;
}

const signedLike = (v: FormValues) => ['signed', 'expired', 'terminated'].includes(asString(v['status']));

export function contractFields(salons: readonly SelectOption[] | null): FieldDef[] {
  const fields: FieldDef[] = [];
  if (salons) fields.push({ key: 'salonId', label: 'Salon', type: 'select', required: true, span: 'full', options: [{ value: '', label: 'Pick a salon' }, ...salons] });
  fields.push(
    { key: 'kind', label: 'Type', type: 'select', default: 'subscription', options: CONTRACT_KINDS },
    { key: 'status', label: 'Status', type: 'select', default: 'draft', options: CONTRACT_STATUSES.map(({ value, label }) => ({ value, label })) },
    { key: 'number', label: 'Number', type: 'text', maxLength: 60, placeholder: 'Leave empty: VIN-2026-001…' },
    { key: 'signedOn', label: 'Signed on', type: 'date', default: todayISO, show: signedLike, required: signedLike },
    { key: 'startsOn', label: 'Starts on', type: 'date' },
    { key: 'endsOn', label: 'Ends on', type: 'date', validate: notBefore('startsOn', 'The contract ends on or after it starts.') },
    { key: 'renewalOn', label: 'Renewal on', type: 'date', hint: 'Shows up in Deadlines.' },
    { key: 'autoRenew', label: 'Renewal', type: 'check', checkLabel: 'Renews automatically' },
    { key: 'notes', label: 'Notes', type: 'textarea', span: 'full', placeholder: 'e.g. Signed in person, the original is in the office folder' },
  );
  return fields;
}

export function contractBody(v: FormValues): Record<string, unknown> {
  const date = (k: string) => asString(v[k]) || null;
  return {
    ...(v['salonId'] ? { salonId: asString(v['salonId']) } : {}),
    kind: asString(v['kind']) || 'subscription',
    status: asString(v['status']) || 'draft',
    number: asString(v['number']),
    signedOn: signedLike(v) ? date('signedOn') : null,
    startsOn: date('startsOn'),
    endsOn: date('endsOn'),
    renewalOn: date('renewalOn'),
    autoRenew: asBoolean(v['autoRenew']),
    notes: asString(v['notes']),
  };
}
