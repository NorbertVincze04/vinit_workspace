import { FieldDef, FormValues, SelectOption, StatusTone, asBoolean, asString } from '../../../shared/ui';

export type ServiceCategory = 'hosting' | 'database' | 'sms' | 'domain' | 'email' | 'tooling' | 'other';

export const SERVICE_CATEGORIES: readonly { value: ServiceCategory; label: string }[] = [
  { value: 'hosting', label: 'Hosting' },
  { value: 'database', label: 'Database' },
  { value: 'sms', label: 'SMS' },
  { value: 'domain', label: 'Domains' },
  { value: 'email', label: 'Email' },
  { value: 'tooling', label: 'Tools' },
  { value: 'other', label: 'Other' },
];
export const serviceCategory = (c: string): string => SERVICE_CATEGORIES.find((x) => x.value === c)?.label ?? c;

/** API row of GET /infra/services (money in bani). */
export interface InfraService {
  id: string;
  name: string;
  vendor: string;
  category: ServiceCategory;
  planName: string;
  monthlyCostBani: number | null;
  currency: 'RON' | 'EUR' | 'USD';
  recurringId: string | null;
  recurringName: string | null;
  renewsOn: string | null;
  dashboardUrl: string;
  statusUrl: string;
  passwordManagerRef: string;
  active: boolean;
  notes: string;
  /** finances = from the linked recurring payment (decision G); estimate = own figure. */
  costSource: 'finances' | 'estimate' | 'none';
  monthlyBani: number;
  monthlyCurrency: 'RON' | 'EUR' | 'USD';
  monthlyRonBani: number;
}

export interface SmsUsage {
  id: string;
  month: string;
  salonId: string | null;
  salonName: string | null;
  sent: number;
  costBani: number;
}

export interface BackupCheck {
  id: string;
  kind: 'backup' | 'restore_test';
  checkedAt: string;
  checkedByName: string | null;
  fileName: string;
  note: string;
}

export interface InfraHealth {
  month: string;
  costs: { monthlyRonBani: number; planBani: number; services: number };
  sms: { sent: number; costBani: number; budget: number; pct: number; premiumSalons: number; perSalonBudget: number | null };
  backups: { lastBackupAt: string | null; lastBackupDays: number | null; lastBackupFile: string | null; lastRestoreTestAt: string | null; lastRestoreTestDays: number | null };
  renewing: { id: string; name: string; renewsOn: string }[];
  storage: { dbBytes: number; fileBytes: number };
  api: { uptimeSeconds: number };
}

/** Backups: fine within a week, worrying after, bad after a month (or never). */
export function backupTone(days: number | null, warnAfter: number, badAfter: number): StatusTone {
  if (days === null || days > badAfter) return 'bad';
  return days > warnAfter ? 'warn' : 'ok';
}

/** Optional amount: empty stays empty (a number field would turn it into 0). */
export const optionalAmount = (v: string): string | null => (/^\d{1,9}([.,]\d{1,2})?$/.test(v.trim()) ? null : 'Enter an amount like 25 or 2,50.');
export const parseOptionalAmount = (v: unknown): number | null => {
  const t = String(v ?? '').trim().replace(',', '.');
  return t === '' ? null : Number(t);
};
const noRecurring = (v: FormValues): boolean => !v['recurringId'];

export function serviceFields(recurring: readonly SelectOption[]): FieldDef[] {
  return [
    { key: 'name', label: 'Service', type: 'text', required: true, maxLength: 200, placeholder: 'e.g. Twilio SMS' },
    { key: 'vendor', label: 'Vendor', type: 'text', maxLength: 200, placeholder: 'e.g. Twilio' },
    { key: 'category', label: 'Type', type: 'select', default: 'hosting', options: SERVICE_CATEGORIES },
    { key: 'planName', label: 'Plan', type: 'text', maxLength: 200, placeholder: 'e.g. Pay as you go' },
    {
      key: 'recurringId',
      label: 'Cost from Finances',
      type: 'select',
      span: 'full',
      options: [{ value: '', label: 'Not in Finances: enter an estimate' }, ...recurring],
      hint: 'Link the recurring payment that pays for it, so the cost is entered once.',
    },
    { key: 'monthlyCost', label: 'Monthly cost (estimate)', type: 'text', maxLength: 12, placeholder: 'Empty if unknown', show: noRecurring, validate: optionalAmount },
    {
      key: 'currency',
      label: 'Currency',
      type: 'select',
      default: 'RON',
      show: noRecurring,
      options: [
        { value: 'RON', label: 'RON' },
        { value: 'EUR', label: 'EUR' },
        { value: 'USD', label: 'USD' },
      ],
    },
    { key: 'renewsOn', label: 'Renews on', type: 'date', hint: 'Shows up in the Calendar.' },
    { key: 'dashboardUrl', label: 'Dashboard link', type: 'url', maxLength: 500, placeholder: 'https://console.twilio.com' },
    { key: 'statusUrl', label: 'Status page', type: 'url', maxLength: 500, placeholder: 'https://status.twilio.com' },
    {
      key: 'passwordManagerRef',
      label: 'Password manager entry',
      type: 'text',
      maxLength: 500,
      span: 'full',
      placeholder: 'Bitwarden › VINIT › Twilio',
      hint: 'Where the login is stored. Never type the password here.',
    },
    { key: 'active', label: 'In use', type: 'check', checkLabel: 'We pay for it now', default: true },
    { key: 'notes', label: 'Notes', type: 'textarea', span: 'full', placeholder: 'e.g. Billed in USD on the company card' },
  ];
}

export function serviceBody(v: FormValues): Record<string, unknown> {
  const recurringId = asString(v['recurringId']) || null;
  const cost = parseOptionalAmount(v['monthlyCost']);
  return {
    name: asString(v['name']),
    vendor: asString(v['vendor']),
    category: asString(v['category']) || 'other',
    planName: asString(v['planName']),
    recurringId,
    monthlyCostBani: recurringId || cost === null ? null : Math.round(cost * 100),
    currency: asString(v['currency']) || 'RON',
    renewsOn: asString(v['renewsOn']) || null,
    dashboardUrl: asString(v['dashboardUrl']),
    statusUrl: asString(v['statusUrl']),
    passwordManagerRef: asString(v['passwordManagerRef']),
    active: asBoolean(v['active']),
    notes: asString(v['notes']),
  };
}
