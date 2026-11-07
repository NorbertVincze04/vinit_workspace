import { FieldMap, field } from '../../../core/api/api-fields';
import { Entity } from '../../../core/models';
import { StatusTone } from '../../../shared/ui';

export type SubStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'ended';
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'one_off';
export type ChangeKind = 'upgrade' | 'downgrade' | 'price_change' | 'pause' | 'resume' | 'cancel' | 'trial_converted' | 'past_due' | 'end';
export type PaymentStatus = 'due' | 'paid' | 'void' | 'waived';
export type PaymentKind = 'subscription' | 'one_off' | 'extra_work';

interface Labelled<V extends string> {
  value: V;
  label: string;
  tone: StatusTone;
}

export const SUB_STATUSES: readonly Labelled<SubStatus>[] = [
  { value: 'trialing', label: 'Trial', tone: 'info' },
  { value: 'active', label: 'Active', tone: 'ok' },
  { value: 'past_due', label: 'Past due', tone: 'bad' },
  { value: 'paused', label: 'Paused', tone: 'warn' },
  { value: 'canceled', label: 'Canceled', tone: 'neutral' },
  { value: 'ended', label: 'Ended', tone: 'neutral' },
];
export const LIVE: readonly SubStatus[] = ['trialing', 'active', 'past_due', 'paused'];

export const PAYMENT_STATUSES: readonly Labelled<PaymentStatus | 'overdue'>[] = [
  { value: 'due', label: 'Due', tone: 'info' },
  { value: 'overdue', label: 'Overdue', tone: 'bad' },
  { value: 'paid', label: 'Paid', tone: 'ok' },
  { value: 'waived', label: 'Waived', tone: 'neutral' },
  { value: 'void', label: 'Void', tone: 'neutral' },
];

export const CYCLES: readonly { value: BillingCycle; label: string; per: string; months: number }[] = [
  { value: 'monthly', label: 'Monthly', per: '/ month', months: 1 },
  { value: 'quarterly', label: 'Every 3 months', per: '/ quarter', months: 3 },
  { value: 'yearly', label: 'Yearly', per: '/ year', months: 12 },
  { value: 'one_off', label: 'One-off project', per: 'once', months: 0 },
];

export const PAYMENT_KINDS: readonly { value: PaymentKind; label: string }[] = [
  { value: 'subscription', label: 'Subscription' },
  { value: 'extra_work', label: 'Extra work (100 RON/h)' },
  { value: 'one_off', label: 'One-off project' },
];

export const CHANGE_LABELS: Record<ChangeKind | 'start', string> = {
  start: 'Started',
  upgrade: 'Upgraded',
  downgrade: 'Downgraded',
  price_change: 'Price changed',
  pause: 'Paused',
  resume: 'Resumed',
  cancel: 'Canceled',
  trial_converted: 'Trial converted',
  past_due: 'Marked past due',
  end: 'Ended',
};

export const subStatus = (s: string) => SUB_STATUSES.find((x) => x.value === s) ?? SUB_STATUSES[0];
export const paymentStatus = (p: Pick<Payment, 'status' | 'overdue'>) =>
  PAYMENT_STATUSES.find((x) => x.value === (p.overdue ? 'overdue' : p.status)) ?? PAYMENT_STATUSES[0];
export const cycleInfo = (c: string) => CYCLES.find((x) => x.value === c) ?? CYCLES[0];
export const kindLabel = (k: string): string => PAYMENT_KINDS.find((x) => x.value === k)?.label.replace(/ \(.*\)$/, '') ?? k;

/** A salon's subscription. Money in RON. */
export interface Subscription extends Entity {
  salonId: string;
  planId: string;
  price: number;
  billingCycle: BillingCycle;
  status: SubStatus;
  startedOn: string;
  trialEndsOn: string;
  minTermEndsOn: string;
  promotionId: string;
  canceledOn: string;
  cancelReason: string;
  notes: string;
  // from the server
  salonName: string;
  salonStatus: string;
  planCode: string;
  planName: string;
  promotionCode: string;
  promotionName: string;
  /** Monthly recurring revenue from it (0 unless active / past due). */
  mrr: number;
}

export const SUBSCRIPTION_FIELD_MAP: FieldMap<Subscription> = {
  salonId: field.readOnly(field.ref()),
  planId: field.readOnly(field.ref()),
  price: field.readOnly(field.money('priceBani')),
  billingCycle: field.readOnly(field.text()),
  status: field.readOnly(field.text()),
  startedOn: field.readOnly(field.date()),
  trialEndsOn: field.date(),
  minTermEndsOn: field.date(),
  promotionId: field.readOnly(field.ref()),
  canceledOn: field.readOnly(field.date()),
  cancelReason: field.readOnly(field.text()),
  notes: field.text(),
  salonName: field.readOnly(field.text()),
  salonStatus: field.readOnly(field.text()),
  planCode: field.readOnly(field.text()),
  planName: field.readOnly(field.text()),
  promotionCode: field.readOnly(field.text()),
  promotionName: field.readOnly(field.text()),
  mrr: field.readOnly(field.money('mrrBani')),
};

export interface Payment extends Entity {
  salonId: string;
  subscriptionId: string;
  kind: PaymentKind;
  periodStart: string;
  periodEnd: string;
  amount: number;
  dueOn: string;
  paidOn: string;
  status: PaymentStatus;
  method: string;
  invoiceNumber: string;
  notes: string;
  // from the server
  salonName: string;
  overdue: boolean;
  /** The Finances income entry created when it was marked paid. */
  transactionId: string;
}

export const PAYMENT_FIELD_MAP: FieldMap<Payment> = {
  salonId: field.ref(),
  subscriptionId: field.ref(),
  kind: field.text(),
  periodStart: field.date(),
  periodEnd: field.date(),
  amount: field.money('amountBani'),
  dueOn: field.date(),
  paidOn: field.readOnly(field.date()),
  status: field.text(),
  method: field.text(),
  invoiceNumber: field.text(),
  notes: field.text(),
  salonName: field.readOnly(field.text()),
  overdue: field.readOnly(field.bool()),
  transactionId: field.readOnly(field.ref()),
};

export interface SubscriptionChange {
  id: string;
  kind: ChangeKind | 'start';
  changedOn: string;
  fromPlanName: string | null;
  toPlanName: string | null;
  fromPriceBani: number | null;
  toPriceBani: number | null;
  fromStatus: string | null;
  toStatus: string;
  note: string;
  changedByName: string | null;
}

export interface BillingWarning {
  kind: string;
  severity: 'info' | 'warn' | 'bad';
  message: string;
  salonId?: string;
  salonName?: string;
  subscriptionId?: string;
  paymentId?: string;
  dueOn?: string;
}

export interface MrrPoint {
  month: string;
  mrrBani: number;
  paying: number;
}

/** GET /salons/:id/overview → billing (raw API rows). */
export interface SalonBilling {
  subscription: Record<string, unknown> | null;
  past: Record<string, unknown>[];
  changes: SubscriptionChange[];
  payments: Record<string, unknown>[];
}

/** Which changes the UI offers for a status (the API checks the same rules). */
export const CHANGES_FOR: Record<SubStatus, readonly ChangeKind[]> = {
  trialing: ['trial_converted', 'upgrade', 'downgrade', 'price_change', 'pause', 'cancel'],
  active: ['upgrade', 'downgrade', 'price_change', 'past_due', 'pause', 'cancel', 'end'],
  past_due: ['resume', 'upgrade', 'downgrade', 'price_change', 'pause', 'cancel'],
  paused: ['resume', 'upgrade', 'downgrade', 'price_change', 'cancel'],
  canceled: [],
  ended: [],
};

export const CHANGE_ACTIONS: Record<ChangeKind, string> = {
  trial_converted: 'Convert trial to paid',
  upgrade: 'Upgrade plan',
  downgrade: 'Downgrade plan',
  price_change: 'Change price',
  past_due: 'Mark past due',
  pause: 'Pause',
  resume: 'Resume',
  cancel: 'Cancel subscription',
  end: 'End (project finished)',
};
