import { fromLocalDateTime, todayISO } from '../../../core/utils/date';
import { FieldDef, FormValues, SelectOption, asBoolean, asString } from '../../../shared/ui';
import { clientBody, clientFormFields } from '../clients/clients.fields';
import { Client, cleanDomain } from '../clients/clients.model';
import { DEPLOY_STATUSES, DNS_STATUSES, Plan, SALON_STATUSES, SSL_STATUSES, Salon, asOptions } from './salons.model';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const checkSlug = (v: string): string | null =>
  v.length > 63 || !SLUG.test(v) ? 'Tenant slug: lower-case letters, digits and single dashes, like barber-house.' : null;
const checkDomain = (v: string): string | null => (cleanDomain(v) ? null : 'Enter a domain like salonname.ro.');
const checkUrl = (v: string): string | null => (/^https?:\/\/\S+$/i.test(v) ? null : 'Enter a full link, starting with https://');

export const planOptions = (plans: readonly Plan[]): SelectOption[] => [
  { value: '', label: 'No plan yet' },
  ...plans.map((p) => ({ value: p.id, label: p.monthlyPrice ? `${p.name} (${p.monthlyPrice} RON / month)` : p.name })),
];

const NEW_CLIENT = 'new';
const isNewClient = (v: FormValues): boolean => v['clientId'] === NEW_CLIENT;

/** "New salon": pick a client without a salon, or enter a new one in the same dialog. */
export function newSalonFields(freeClients: readonly Client[], plans: readonly Plan[]): FieldDef[] {
  return [
    { key: 'name', label: 'Salon name', type: 'text', required: true, maxLength: 200, span: 'full', placeholder: 'Barber House' },
    { key: 'city', label: 'City', type: 'text', maxLength: 100 },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      default: 'trial',
      options: asOptions(SALON_STATUSES.filter((s) => s.value !== 'churned')),
    },
    { key: 'planId', label: 'Plan', type: 'select', default: plans.find((p) => p.code === 'standard')?.id ?? '', options: planOptions(plans) },
    { key: 'domain', label: 'Domain', type: 'text', maxLength: 253, placeholder: 'barberhouse.ro', validate: checkDomain },
    {
      key: 'clientId',
      label: 'Billed to (who pays)',
      type: 'select',
      default: NEW_CLIENT,
      span: 'full',
      options: [
        { value: NEW_CLIENT, label: 'Enter billing details…' },
        ...freeClients.map((c) => ({ value: c.id, label: c.name })),
      ],
      hint: 'Usually new details. Only payers without a salon are listed.',
    },
    ...clientFormFields('client.', isNewClient),
    { key: 'notes', label: 'Notes', type: 'textarea', span: 'full' },
  ];
}

/** The new client; its city defaults to the salon's. */
function newClient(v: FormValues): Partial<Client> {
  const client = clientBody(v, 'client.');
  return { ...client, city: client.city || asString(v['city']) };
}

export function newSalonBody(v: FormValues): Record<string, unknown> {
  const domain = cleanDomain(asString(v['domain']));
  return {
    name: asString(v['name']),
    city: asString(v['city']),
    status: asString(v['status']) || 'trial',
    planId: asString(v['planId']) || null,
    notes: asString(v['notes']),
    ...(domain ? { domain } : {}),
    ...(isNewClient(v) ? { client: newClient(v) } : { clientId: asString(v['clientId']) }),
  };
}

/** Editing the salon itself (status has its own dialog, client its own form). */
export function editSalonFields(plans: readonly Plan[], others: readonly Salon[]): FieldDef[] {
  return [
    { key: 'name', label: 'Salon name', type: 'text', required: true, maxLength: 200, span: 'full' },
    { key: 'city', label: 'City', type: 'text', maxLength: 100 },
    { key: 'planId', label: 'Plan', type: 'select', options: planOptions(plans) },
    {
      key: 'tenantSlug',
      label: 'Tenant slug',
      type: 'text',
      maxLength: 63,
      placeholder: 'barber-house',
      hint: 'Same as the shop slug in the booking product.',
      validate: checkSlug,
    },
    { key: 'deployStatus', label: 'Deploy', type: 'select', default: 'not_deployed', options: asOptions(DEPLOY_STATUSES) },
    { key: 'configVersion', label: 'JSON config version', type: 'text', maxLength: 100, placeholder: 'v3' },
    { key: 'configUrl', label: 'JSON config link', type: 'text', maxLength: 500, placeholder: 'https://…', validate: checkUrl },
    { key: 'signedAt', label: 'Signed', type: 'datetime' },
    { key: 'goLiveOn', label: 'Went live on', type: 'date' },
    { key: 'uptimeMonitorId', label: 'Uptime monitor id', type: 'text', maxLength: 100 },
    {
      key: 'referredBySalonId',
      label: 'Referred by',
      type: 'select',
      options: [{ value: '', label: 'Nobody' }, ...others.map((s) => ({ value: s.id, label: s.name }))],
    },
    { key: 'notes', label: 'Notes', type: 'textarea', span: 'full' },
  ];
}

export function editSalonPatch(v: FormValues, before: Salon): Partial<Salon> {
  const config = asString(v['configVersion']);
  const patch: Partial<Salon> = {
    name: asString(v['name']),
    city: asString(v['city']),
    planId: asString(v['planId']),
    tenantSlug: asString(v['tenantSlug']),
    deployStatus: (asString(v['deployStatus']) || 'not_deployed') as Salon['deployStatus'],
    configVersion: config,
    configUrl: asString(v['configUrl']),
    signedAt: fromLocalDateTime(asString(v['signedAt'])),
    goLiveOn: asString(v['goLiveOn']),
    uptimeMonitorId: asString(v['uptimeMonitorId']),
    referredBySalonId: asString(v['referredBySalonId']),
    notes: asString(v['notes']),
  };
  if (config !== before.configVersion) patch.configUpdatedAt = new Date().toISOString();
  if (patch.deployStatus === 'live' && before.deployStatus !== 'live') patch.deployedAt = new Date().toISOString();
  return patch;
}

export const STATUS_FIELDS: readonly FieldDef[] = [
  { key: 'status', label: 'New status', type: 'select', options: asOptions(SALON_STATUSES) },
  { key: 'changedOn', label: 'Since', type: 'date', default: todayISO },
  {
    key: 'reason',
    label: 'Reason',
    type: 'textarea',
    span: 'full',
    maxLength: 1000,
    required: (v) => v['status'] === 'churned',
    placeholder: 'Why did it change? Required when the salon leaves (used for retention).',
  },
];

export function statusBody(v: FormValues): { status: string; changedOn: string | null; reason: string } {
  return { status: asString(v['status']), changedOn: asString(v['changedOn']) || null, reason: asString(v['reason']) };
}

export const DOMAIN_FIELDS: readonly FieldDef[] = [
  { key: 'domain', label: 'Domain', type: 'text', required: true, maxLength: 253, placeholder: 'barberhouse.ro', validate: checkDomain },
  { key: 'registrar', label: 'Registrar', type: 'text', maxLength: 100, placeholder: 'ROTLD, Namecheap…' },
  { key: 'expiresOn', label: 'Expires on', type: 'date' },
  { key: 'autoRenew', label: 'Renewal', type: 'check', checkLabel: 'Renews automatically', default: true },
  { key: 'dnsStatus', label: 'DNS', type: 'select', default: 'pending', options: asOptions(DNS_STATUSES) },
  { key: 'sslStatus', label: 'SSL', type: 'select', default: 'pending', options: asOptions(SSL_STATUSES) },
  { key: 'sslExpiresOn', label: 'SSL expires on', type: 'date' },
  { key: 'isPrimary', label: 'Primary', type: 'check', checkLabel: 'Main address of the site' },
  {
    key: 'passwordManagerRef',
    label: 'Password manager entry',
    type: 'text',
    maxLength: 500,
    span: 'full',
    placeholder: 'Bitwarden › Domains › barberhouse.ro',
    hint: 'Where the registrar login is stored. Never type the password here.',
  },
  { key: 'notes', label: 'Notes', type: 'textarea', span: 'full' },
];

export function domainBody(v: FormValues): Record<string, unknown> {
  return {
    domain: cleanDomain(asString(v['domain'])) ?? asString(v['domain']),
    registrar: asString(v['registrar']),
    expiresOn: asString(v['expiresOn']) || null,
    autoRenew: asBoolean(v['autoRenew']),
    dnsStatus: asString(v['dnsStatus']) || 'pending',
    sslStatus: asString(v['sslStatus']) || 'pending',
    sslExpiresOn: asString(v['sslExpiresOn']) || null,
    isPrimary: asBoolean(v['isPrimary']),
    passwordManagerRef: asString(v['passwordManagerRef']),
    notes: asString(v['notes']),
  };
}
