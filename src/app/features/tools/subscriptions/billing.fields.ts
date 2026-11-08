import { todayISO } from '../../../core/utils/date';
import { FieldDef, FormValues, SelectOption, asBoolean, asNumber, asString, notBefore } from '../../../shared/ui';

/** A payment date can't be in the future (it is when the money arrived). */
const notFuture = (v: string): string | null => (v > todayISO() ? 'The payment date can’t be in the future.' : null);
import { Plan, Promotion } from '../salons/salons.model';
import { CHANGE_ACTIONS, CYCLES, ChangeKind, PAYMENT_KINDS, Subscription } from './billing.model';
import { t } from '../../../core/i18n/i18n';
import { tc } from '../../../core/i18n/content';

const bani = (ron: number): number => Math.round(ron * 100);

/** Default price for a plan, cycle and promotion (RON per period). */
export function suggestedPrice(plan: Plan | undefined, cycle: string, promo: Promotion | undefined): number {
  if (!plan) return 0;
  const months = CYCLES.find((c) => c.value === cycle)?.months ?? 1;
  const base = cycle === 'one_off' ? plan.oneOffFrom || plan.monthlyPrice : plan.monthlyPrice * months;
  return promo?.discountPct ? Math.round(base * (100 - promo.discountPct)) / 100 : base;
}

const promoLabel = (p: Promotion): string => {
  let what = p.freeMonths ? t('{n} months free', { n: p.freeMonths }) : p.discountPct ? t('{pct}% off', { pct: p.discountPct }) : '';
  // "50% off (50% off)" says it twice.
  if (what && p.name.toLowerCase().includes(what.split(' ')[0].toLowerCase())) what = '';
  const places = p.maxSalons ? ` · ${t('{n} of {total} left', { n: Math.max(0, p.maxSalons - p.used), total: p.maxSalons })}` : '';
  const name = tc(p.name);
  return `${name}${what ? ` (${what}${places})` : places ? ` (${places.slice(3)})` : ''}`;
};

/**
 * New subscription. Picking the plan, cycle or promotion fills in the price; a promotion with
 * free months starts a trial (the end date is computed by the server when left empty).
 */
export function newSubscriptionFields(
  plans: readonly Plan[],
  promotions: readonly Promotion[],
  salons: readonly SelectOption[] | null,
  defaultPlanId: string,
): FieldDef[] {
  const plan = (v: FormValues) => plans.find((p) => p.id === v['planId']);
  const promo = (v: FormValues) => promotions.find((p) => p.id === v['promotionId']);
  const reprice = (v: FormValues) => ({ price: suggestedPrice(plan(v), asString(v['billingCycle']), promo(v)) });
  const offered = promotions.filter((p) => p.isActive);
  const start = plans.find((p) => p.id === defaultPlanId) ?? plans.find((p) => p.code === 'standard');

  const fields: FieldDef[] = [];
  if (salons) fields.push({ key: 'salonId', label: 'Salon', type: 'select', required: true, span: 'full', options: [{ value: '', label: 'Pick a salon' }, ...salons] });
  fields.push(
    {
      key: 'planId',
      label: 'Plan',
      type: 'select',
      required: true,
      default: start?.id ?? '',
      options: plans.map((p) => ({ value: p.id, label: p.name })),
      onChange: reprice,
    },
    { key: 'billingCycle', label: 'Billing', type: 'select', default: 'monthly', options: CYCLES, onChange: reprice },
    {
      key: 'promotionId',
      label: 'Promotion',
      type: 'select',
      span: 'full',
      options: [{ value: '', label: 'No promotion' }, ...offered.map((p) => ({ value: p.id, label: promoLabel(p) }))],
      onChange: reprice,
      hint: 'Early Bird: 3 free months for the first 50 salons. Beta salons use "Beta" and don’t take Early Bird places.',
    },
    {
      key: 'price',
      label: 'Price per period (RON)',
      type: 'number',
      required: true,
      min: 0,
      default: suggestedPrice(start, 'monthly', undefined),
      hint: 'What the salon pays after any free months.',
    },
    { key: 'startedOn', label: 'Starts on', type: 'date', default: todayISO },
    {
      key: 'trialEndsOn',
      label: 'Free until (last free day)',
      type: 'date',
      validate: notBefore('startedOn', 'The free months end on or after the start.'),
      hint: 'Leave empty: worked out from the promotion’s free months.',
    },
    {
      key: 'status',
      label: 'Starts as',
      type: 'switch',
      default: 'auto',
      span: 'full',
      options: [
        { value: 'auto', label: 'Automatic' },
        { value: 'trialing', label: 'Trial' },
        { value: 'active', label: 'Paying now' },
      ],
    },
    { key: 'notes', label: 'Notes', type: 'textarea', span: 'full', placeholder: 'e.g. Agreed in person, pays by bank transfer at the start of the month' },
  );
  return fields;
}

export function newSubscriptionBody(v: FormValues): Record<string, unknown> {
  const status = asString(v['status']);
  return {
    planId: asString(v['planId']),
    billingCycle: asString(v['billingCycle']) || 'monthly',
    promotionId: asString(v['promotionId']) || null,
    priceBani: bani(asNumber(v['price'])),
    startedOn: asString(v['startedOn']) || undefined,
    ...(asString(v['trialEndsOn']) ? { trialEndsOn: asString(v['trialEndsOn']) } : {}),
    ...(status === 'trialing' || status === 'active' ? { status } : {}),
    notes: asString(v['notes']),
  };
}

/** Fields for one kind of change. */
export function changeFields(kind: ChangeKind, sub: Subscription, plans: readonly Plan[]): FieldDef[] {
  const on: FieldDef = { key: 'on', label: 'From', type: 'date', default: todayISO };
  const note: FieldDef = { key: 'note', label: 'Note', type: 'textarea', span: 'full', maxLength: 1000, placeholder: 'Why it changed (kept in the salon’s history)' };
  switch (kind) {
    case 'upgrade':
    case 'downgrade': {
      const others = plans.filter((p) => p.id !== sub.planId);
      const first = others[0];
      return [
        {
          key: 'planId',
          label: 'New plan',
          type: 'select',
          required: true,
          default: first?.id ?? '',
          options: others.map((p) => ({ value: p.id, label: p.name })),
          onChange: (v) => ({ price: suggestedPrice(plans.find((p) => p.id === v['planId']), sub.billingCycle, undefined) }),
        },
        { key: 'price', label: 'New price per period (RON)', type: 'number', required: true, min: 0, default: suggestedPrice(first, sub.billingCycle, undefined) },
        on,
        note,
      ];
    }
    case 'price_change':
      return [{ key: 'price', label: 'New price per period (RON)', type: 'number', required: true, min: 0, default: sub.price }, on, note];
    case 'trial_converted':
      return [{ key: 'price', label: 'Price per period (RON)', type: 'number', required: true, min: 0, default: sub.price }, on, note];
    case 'cancel':
      return [on, { ...note, label: 'Why does the salon leave?', required: true, hint: 'Used for churn and retention.' }];
    default:
      return [on, note];
  }
}

export function changeBody(kind: ChangeKind, v: FormValues): Record<string, unknown> {
  const body: Record<string, unknown> = { kind, on: asString(v['on']) || undefined, note: asString(v['note']) };
  if (v['planId']) body['planId'] = asString(v['planId']);
  if (v['price'] !== undefined && v['price'] !== '') body['priceBani'] = bani(asNumber(v['price']));
  return body;
}

export const changeTitle = (kind: ChangeKind): string => CHANGE_ACTIONS[kind];

export function paymentFields(salons: readonly SelectOption[] | null): FieldDef[] {
  const fields: FieldDef[] = [];
  if (salons) fields.push({ key: 'salonId', label: 'Salon', type: 'select', required: true, span: 'full', options: [{ value: '', label: 'Pick a salon' }, ...salons] });
  fields.push(
    { key: 'kind', label: 'For', type: 'select', default: 'extra_work', options: PAYMENT_KINDS },
    { key: 'amount', label: 'Amount (RON)', type: 'number', required: true, min: 0.01, placeholder: '150' },
    { key: 'dueOn', label: 'Due on', type: 'date', required: true, default: todayISO },
    { key: 'invoiceNumber', label: 'Invoice number', type: 'text', maxLength: 100, placeholder: 'VIN-0042' },
    { key: 'periodStart', label: 'Period from', type: 'date' },
    { key: 'periodEnd', label: 'Period to', type: 'date', validate: notBefore('periodStart', 'The period ends on or after its start.') },
    { key: 'notes', label: 'Notes', type: 'textarea', span: 'full', placeholder: 'e.g. Extra work: new gallery page, 90 min' },
  );
  return fields;
}

export const MARK_PAID_FIELDS: readonly FieldDef[] = [
  { key: 'paidOn', label: 'Paid on', type: 'date', required: true, default: todayISO, validate: notFuture },
  { key: 'method', label: 'Method', type: 'select', default: 'bank_transfer', options: [
    { value: 'bank_transfer', label: 'Bank transfer' },
    { value: 'card', label: 'Card' },
    { value: 'cash', label: 'Cash' },
    { value: 'other', label: 'Other' },
  ] },
  { key: 'invoiceNumber', label: 'Invoice number', type: 'text', maxLength: 100, placeholder: 'VIN-0042' },
  {
    key: 'createTransaction',
    label: 'Finances',
    type: 'check',
    default: true,
    checkLabel: 'Add the income to Finances',
    span: 'full',
  },
];

export function markPaidBody(v: FormValues): Record<string, unknown> {
  return {
    paidOn: asString(v['paidOn']),
    method: asString(v['method']),
    ...(asString(v['invoiceNumber']) ? { invoiceNumber: asString(v['invoiceNumber']) } : {}),
    createTransaction: asBoolean(v['createTransaction']),
  };
}
