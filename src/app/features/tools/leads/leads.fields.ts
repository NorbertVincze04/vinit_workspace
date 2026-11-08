import { fromLocalDateTime } from '../../../core/utils/date';
import { FieldDef, FormValues, asNumber, asString, validInstagram, validWebsite } from '../../../shared/ui';
import { clientFormFields } from '../clients/clients.fields';
import { cleanDomain } from '../clients/clients.model';
import { planOptions } from '../salons/salons.fields';
import { Plan, Salon } from '../salons/salons.model';
import { ACTIVITY_KINDS, LEAD_SOURCES, LEAD_STAGES, LOST_REASONS, Lead, OPEN_STAGES } from './leads.model';

const isLost = (v: FormValues): boolean => v['stage'] === 'lost';

export function leadFields(plans: readonly Plan[], salons: readonly Salon[], isNew: boolean): FieldDef[] {
  const fields: FieldDef[] = [
    { key: 'businessName', label: 'Business name', type: 'text', required: true, maxLength: 200, span: 'full', placeholder: 'Barber Club' },
    { key: 'contactName', label: 'Contact person', type: 'text', maxLength: 200, placeholder: 'e.g. Andrei Popescu' },
    { key: 'city', label: 'City', type: 'text', maxLength: 100, placeholder: 'Cluj-Napoca' },
    { key: 'phone', label: 'Phone', type: 'tel', maxLength: 40, placeholder: '0740 123 456' },
    { key: 'email', label: 'Email', type: 'email', maxLength: 200, placeholder: 'contact@barberclub.ro' },
    { key: 'instagram', label: 'Instagram', type: 'text', maxLength: 200, placeholder: '@barberclub', validate: validInstagram },
    { key: 'website', label: 'Website', type: 'text', maxLength: 500, placeholder: 'barberclub.ro', validate: validWebsite },
    { key: 'employees', label: 'Barbers / staff', type: 'number', integer: true, min: 0, max: 500, placeholder: 'Unknown' },
    { key: 'services', label: 'Services', type: 'text', maxLength: 2000, placeholder: 'Haircut, beard, kids' },
    { key: 'source', label: 'Source', type: 'select', default: 'instagram_dm', options: LEAD_SOURCES },
    { key: 'sourceDetail', label: 'Source detail', type: 'text', maxLength: 500, placeholder: 'Campaign, event, who referred them' },
    {
      key: 'referredBySalonId',
      label: 'Referred by salon',
      type: 'select',
      show: (v) => v['source'] === 'referral',
      options: [{ value: '', label: 'Pick the salon' }, ...salons.map((s) => ({ value: s.id, label: s.name }))],
    },
    { key: 'interestedPlanId', label: 'Interested in', type: 'select', options: planOptions(plans) },
    { key: 'nextFollowUpOn', label: 'Next follow-up', type: 'date' },
    { key: 'demoAt', label: 'Demo', type: 'datetime' },
  ];
  if (isNew) {
    fields.push(
      {
        key: 'stage',
        label: 'Stage',
        type: 'select',
        default: 'contacted',
        options: LEAD_STAGES.filter((s) => OPEN_STAGES.includes(s.value)).map(({ value, label }) => ({ value, label })),
      },
      { key: 'lostReason', label: 'Why lost', type: 'select', show: isLost, options: LOST_REASONS },
    );
  }
  fields.push({ key: 'notes', label: 'Notes', type: 'textarea', span: 'full', placeholder: 'What matters for the sale: current booking tool, prices, objections…' });
  return fields;
}

export function leadBody(v: FormValues, isNew: boolean): Omit<Partial<Lead>, 'stage'> & { stage?: string } {
  const body: Omit<Partial<Lead>, 'stage'> & { stage?: string } = {
    businessName: asString(v['businessName']),
    contactName: asString(v['contactName']),
    city: asString(v['city']),
    phone: asString(v['phone']),
    email: asString(v['email']),
    instagram: asString(v['instagram']),
    website: asString(v['website']),
    employees: asNumber(v['employees']),
    services: asString(v['services']),
    source: (asString(v['source']) || 'other') as Lead['source'],
    sourceDetail: asString(v['sourceDetail']),
    referredBySalonId: asString(v['referredBySalonId']),
    interestedPlanId: asString(v['interestedPlanId']),
    nextFollowUpOn: asString(v['nextFollowUpOn']),
    demoAt: fromLocalDateTime(asString(v['demoAt'])),
    notes: asString(v['notes']),
  };
  if (isNew) {
    body.stage = asString(v['stage']) || 'contacted';
    if (body.stage === 'lost') body.lostReason = asString(v['lostReason']) as Lead['lostReason'];
  }
  return body;
}

export const LOST_FIELDS: readonly FieldDef[] = [
  { key: 'lostReason', label: 'Why was it lost?', type: 'select', default: 'no_reply', options: LOST_REASONS, span: 'full' },
  { key: 'lostNote', label: 'Note', type: 'textarea', maxLength: 1000, span: 'full', placeholder: 'What did they say?' },
];

export const ACTIVITY_FIELDS: readonly FieldDef[] = [
  { key: 'kind', label: 'Type', type: 'switch', default: 'dm', options: ACTIVITY_KINDS, span: 'full' },
  { key: 'body', label: 'What happened', type: 'textarea', required: true, maxLength: 5000, span: 'full', placeholder: 'What happened? e.g. Sent the demo link, they reply next week' },
  { key: 'nextFollowUpOn', label: 'Next follow-up', type: 'date', hint: 'Leave empty to keep the current one.' },
];

const NEW_CLIENT = 'new';

/** Convert: the salon (pre-filled from the lead) and who pays for it (a new client by default). */
export function convertFields(lead: Lead, plans: readonly Plan[], freeClients: readonly { id: string; name: string }[]): FieldDef[] {
  return [
    { key: 'name', label: 'Salon name', type: 'text', required: true, maxLength: 200, default: lead.businessName, placeholder: 'Barber Club' },
    { key: 'city', label: 'City', type: 'text', maxLength: 100, default: lead.city, placeholder: 'Cluj-Napoca' },
    {
      key: 'status',
      label: 'Starts as',
      type: 'switch',
      default: 'trial',
      options: [
        { value: 'trial', label: 'Trial (free months)' },
        { value: 'active', label: 'Paying' },
      ],
      span: 'full',
    },
    {
      key: 'planId',
      label: 'Plan',
      type: 'select',
      default: lead.interestedPlanId || (plans.find((p) => p.code === 'standard')?.id ?? ''),
      options: planOptions(plans),
    },
    {
      key: 'domain',
      label: 'Domain',
      type: 'text',
      maxLength: 253,
      placeholder: 'barberclub.ro',
      validate: (v) => (cleanDomain(v) ? null : 'Enter a domain like salonname.ro.'),
    },
    {
      key: 'clientId',
      label: 'Client (who pays)',
      type: 'select',
      default: NEW_CLIENT,
      span: 'full',
      options: [{ value: NEW_CLIENT, label: 'New client…' }, ...freeClients.map((c) => ({ value: c.id, label: c.name }))],
    },
    ...clientFormFields('client.', (v) => v['clientId'] === NEW_CLIENT).map((f) => ({
      ...f,
      default:
        f.key === 'client.name'
          ? lead.businessName
          : f.key === 'client.contactPerson'
            ? lead.contactName
            : f.key === 'client.phone'
              ? lead.phone
              : f.key === 'client.email'
                ? lead.email
                : f.default,
    })),
  ];
}

export function convertBody(v: FormValues): Record<string, unknown> {
  const domain = cleanDomain(asString(v['domain']));
  const salon = {
    name: asString(v['name']),
    city: asString(v['city']),
    status: asString(v['status']) || 'trial',
    planId: asString(v['planId']) || null,
    ...(domain ? { domain } : {}),
  };
  if (v['clientId'] !== NEW_CLIENT) return { clientId: asString(v['clientId']), salon };
  const kind = asString(v['client.kind']) || 'company';
  return {
    salon,
    client: {
      kind,
      name: asString(v['client.name']),
      contactPerson: kind === 'person' ? '' : asString(v['client.contactPerson']),
      phone: asString(v['client.phone']),
      email: asString(v['client.email']),
      city: asString(v['client.city']) || salon.city,
      businessAddress: asString(v['client.businessAddress']),
      billingEmail: asString(v['client.billingEmail']),
    },
  };
}

