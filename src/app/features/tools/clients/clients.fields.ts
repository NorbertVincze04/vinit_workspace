import { FieldDef, FormValues, asString } from '../../../shared/ui';
import { CLIENT_KINDS, Client } from './clients.model';

const isCompany = (v: FormValues): boolean => v['kind'] !== 'person';

/**
 * Client form. `prefix` lets the same fields sit inside another form (the "New salon" dialog
 * uses "client." keys), `show` hides them all when that form does not need them.
 */
export function clientFormFields(prefix = '', show?: (v: FormValues) => boolean): FieldDef[] {
  const k = (key: string): string => prefix + key;
  const when = (extra?: (v: FormValues) => boolean) => (v: FormValues) => (!show || show(v)) && (!extra || extra(strip(v, prefix)));
  return [
    { key: k('kind'), label: 'Client is a', type: 'switch', default: 'company', options: CLIENT_KINDS, span: 'full', show: when() },
    {
      key: k('name'),
      label: 'Name (company or person)',
      type: 'text',
      required: true,
      maxLength: 200,
      span: 'full',
      placeholder: 'Barber House SRL',
      show: when(),
    },
    { key: k('contactPerson'), label: 'Contact person', type: 'text', maxLength: 200, show: when(isCompany) },
    { key: k('phone'), label: 'Phone', type: 'tel', maxLength: 40, show: when() },
    { key: k('email'), label: 'Email', type: 'email', maxLength: 200, show: when() },
    { key: k('city'), label: 'City', type: 'text', maxLength: 100, show: when() },
    {
      key: k('businessAddress'),
      label: 'Business address',
      type: 'text',
      required: true,
      maxLength: 500,
      span: 'full',
      placeholder: 'Street, number, city, county',
      hint: 'Registered address of the business, used on invoices and contracts.',
      show: when(),
    },
    {
      key: k('billingEmail'),
      label: 'Billing email',
      type: 'email',
      maxLength: 200,
      span: 'full',
      hint: 'Only if invoices go to a different address.',
      show: when(),
    },
  ];
}

export const CLIENT_FIELDS: readonly FieldDef[] = [
  ...clientFormFields(),
  { key: 'notes', label: 'Notes', type: 'textarea', span: 'full' },
];

/** Form values (optionally under a prefix) → API body for a client. */
export function clientBody(v: FormValues, prefix = ''): Partial<Client> {
  const s = strip(v, prefix);
  const body: Partial<Client> = {
    kind: (asString(s['kind']) || 'company') as Client['kind'],
    name: asString(s['name']),
    contactPerson: asString(s['kind']) === 'person' ? '' : asString(s['contactPerson']),
    phone: asString(s['phone']),
    email: asString(s['email']),
    city: asString(s['city']),
    businessAddress: asString(s['businessAddress']),
    billingEmail: asString(s['billingEmail']),
  };
  if (!prefix) body.notes = asString(s['notes']);
  return body;
}

/** { "client.name": "x" } with prefix "client." → { name: "x" }. */
function strip(v: FormValues, prefix: string): FormValues {
  if (!prefix) return v;
  const out: FormValues = {};
  for (const [key, value] of Object.entries(v)) if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value;
  return out;
}
