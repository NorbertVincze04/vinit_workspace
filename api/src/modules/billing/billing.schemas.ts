import { z } from 'zod';
import { isoDate, longText, monthKey, optionalDate, text, uuid } from '../../lib/schemas.js';

export const SUB_STATUSES = ['trialing', 'active', 'past_due', 'paused', 'canceled', 'ended'] as const;
export const LIVE_STATUSES = ['trialing', 'active', 'past_due', 'paused'] as const;
/** Statuses that count toward MRR (decision: trialing salons pay nothing yet). */
export const PAYING_STATUSES = ['active', 'past_due'] as const;
export const BILLING_CYCLES = ['monthly', 'quarterly', 'yearly', 'one_off'] as const;
export const CHANGE_KINDS = ['upgrade', 'downgrade', 'price_change', 'pause', 'resume', 'cancel', 'trial_converted', 'past_due', 'end'] as const;

export type SubStatus = (typeof SUB_STATUSES)[number];
export type BillingCycle = (typeof BILLING_CYCLES)[number];
export type ChangeKind = (typeof CHANGE_KINDS)[number] | 'start';

const bani = z.number().int('Money is stored in whole bani.').min(0).max(2_000_000_000);

export const subscriptionCreate = z
  .object({
    planId: uuid,
    /** Default: the plan's price (minus the promotion's discount). */
    priceBani: bani.optional(),
    billingCycle: z.enum(BILLING_CYCLES).optional(),
    startedOn: isoDate.optional(),
    promotionId: uuid.nullable().optional(),
    /** Default: start + the promotion's free months. */
    trialEndsOn: optionalDate.optional(),
    /** Default: trialing when there is a trial end, otherwise active. */
    status: z.enum(['trialing', 'active']).optional(),
    notes: longText.optional(),
  })
  .strict();

/** Fields that don't change what the salon pays. Plan, price and status go through /change. */
export const subscriptionPatch = z
  .object({
    trialEndsOn: optionalDate,
    minTermEndsOn: optionalDate,
    notes: longText,
  })
  .partial()
  .strict();

export const subscriptionChange = z
  .object({
    kind: z.enum(CHANGE_KINDS),
    planId: uuid.optional(),
    priceBani: bani.optional(),
    billingCycle: z.enum(BILLING_CYCLES).optional(),
    on: isoDate.optional(),
    note: text(1000).optional(),
  })
  .strict()
  .refine((v) => !['upgrade', 'downgrade'].includes(v.kind) || !!v.planId, { message: 'Pick the new plan.', path: ['planId'] })
  .refine((v) => v.kind !== 'price_change' || v.priceBani !== undefined, { message: 'Enter the new price.', path: ['priceBani'] })
  .refine((v) => v.kind !== 'cancel' || !!v.note?.trim(), { message: 'Say why the salon cancels (used for retention).', path: ['note'] });

export const paymentFields = z.object({
  salonId: uuid,
  subscriptionId: uuid.nullable(),
  kind: z.enum(['subscription', 'one_off', 'extra_work']),
  periodStart: optionalDate,
  periodEnd: optionalDate,
  amountBani: bani,
  dueOn: isoDate,
  status: z.enum(['due', 'void', 'waived']),
  method: text(100),
  invoiceNumber: text(100),
  invoiceProvider: z.enum(['smartbill', 'oblio']).nullable(),
  invoiceExternalId: text(200),
  invoiceStatus: text(100),
  notes: longText,
});

export const paymentCreate = paymentFields
  .partial()
  .required({ salonId: true, amountBani: true, dueOn: true })
  .extend({ id: uuid.optional() })
  .strict();
export const paymentPatch = paymentFields.omit({ salonId: true, subscriptionId: true }).partial().strict();

export const markPaid = z
  .object({
    paidOn: isoDate.optional(),
    method: text(100).optional(),
    invoiceNumber: text(100).optional(),
    /** Add the income to Finances (default yes). */
    createTransaction: z.boolean().optional(),
  })
  .strict();

export const generateBody = z.object({ month: monthKey }).strict();

export const paymentListQuery = z.object({
  status: z.enum(['due', 'paid', 'void', 'waived', 'overdue']).optional(),
  salonId: uuid.optional(),
});

export const mrrQuery = z.object({ from: monthKey.optional(), to: monthKey.optional() });
