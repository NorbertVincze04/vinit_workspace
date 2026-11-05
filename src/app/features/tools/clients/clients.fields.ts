import { FINANCE } from '../../../core/data/finance.data';
import { EntityData } from '../../../core/models';
import { todayISO } from '../../../core/utils/date';
import { FieldDef, FormValues, asNumber, asString } from '../../../shared/ui';
import { CLIENT_PLANS, CLIENT_STATUSES, Client, ClientPlan, ClientStatus } from './clients.model';

/** Fields of the create / edit client dialog. */
export const CLIENT_FIELDS: readonly FieldDef[] = [
  { key: 'salon', label: 'Salon name', type: 'text', required: true, span: 'full' },
  { key: 'owner', label: 'Owner / contact person', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'domain', label: 'Domain', type: 'text', span: 'full', placeholder: 'salonname.ro' },
  {
    key: 'plan',
    label: 'Package',
    type: 'select',
    default: 'standard',
    options: (Object.keys(CLIENT_PLANS) as ClientPlan[]).map((p) => ({
      value: p,
      label: CLIENT_PLANS[p].price ? `${CLIENT_PLANS[p].label} (${CLIENT_PLANS[p].price} RON)` : CLIENT_PLANS[p].label,
    })),
    // Picking a package fills in its price (custom keeps whatever was typed).
    onChange: (v) => {
      const plan = asString(v['plan']) as ClientPlan;
      return plan !== 'custom' ? { price: CLIENT_PLANS[plan].price } : {};
    },
  },
  {
    key: 'price',
    label: 'Monthly price (RON)',
    type: 'number',
    default: FINANCE.standardPrice,
    hint: 'Counts toward MRR once the client is Active.',
  },
  { key: 'status', label: 'Status', type: 'select', default: 'lead', options: CLIENT_STATUSES },
  { key: 'since', label: 'Client since', type: 'date', default: todayISO },
  {
    key: 'notes',
    label: 'Notes',
    type: 'textarea',
    span: 'full',
    placeholder: 'Barbers, preferences, feedback from the demo',
  },
];

export function clientFromForm(v: FormValues): EntityData<Client> {
  return {
    salon: asString(v['salon']),
    owner: asString(v['owner']),
    city: asString(v['city']),
    phone: asString(v['phone']),
    email: asString(v['email']),
    domain: asString(v['domain']),
    plan: (asString(v['plan']) || 'custom') as ClientPlan,
    price: asNumber(v['price']),
    status: (asString(v['status']) || 'lead') as ClientStatus,
    since: asString(v['since']),
    notes: asString(v['notes']),
  };
}
