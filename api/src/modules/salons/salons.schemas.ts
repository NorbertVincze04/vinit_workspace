import { z } from 'zod';
import {
  domainName,
  longText,
  optionalDate,
  optionalEmail,
  optionalTimestamp,
  phone,
  slug,
  text,
  uuid,
  uuidRef,
} from '../../lib/schemas.js';

const required = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `Use at most ${max} characters.`);

export const CLIENT_KINDS = ['person', 'company'] as const;
export const SALON_STATUSES = ['lead', 'trial', 'active', 'paused', 'churned'] as const;
export const DEPLOY_STATUSES = ['not_deployed', 'building', 'live', 'failed'] as const;
export const DNS_STATUSES = ['pending', 'configured', 'verified', 'error'] as const;
export const SSL_STATUSES = ['pending', 'active', 'expiring', 'error'] as const;

export type SalonStatus = (typeof SALON_STATUSES)[number];

// ---- clients ----

export const clientFields = z.object({
  kind: z.enum(CLIENT_KINDS),
  name: required('Name'),
  contactPerson: text(200),
  email: optionalEmail,
  phone,
  businessAddress: required('The business address', 500),
  city: text(100),
  billingEmail: optionalEmail,
  notes: longText,
});

export const clientCreate = clientFields
  .partial()
  .required({ name: true, businessAddress: true })
  .extend({ id: uuid.optional() })
  .strict();
export const clientPatch = clientFields.partial().strict();

// ---- salons ----

const url = z.union([z.literal(''), z.url('Enter a full link, like https://…').max(500)]);

export const salonFields = z.object({
  name: required('Salon name'),
  tenantSlug: slug.nullable(),
  city: text(100),
  planId: uuidRef,
  configVersion: text(100),
  configUrl: url,
  configUpdatedAt: optionalTimestamp,
  deployStatus: z.enum(DEPLOY_STATUSES),
  deployedAt: optionalTimestamp,
  signedAt: optionalTimestamp,
  goLiveOn: optionalDate,
  referredBySalonId: uuidRef,
  uptimeMonitorId: text(100),
  notes: longText,
});

/** New salon: for an existing client (clientId) or together with a new one (client). */
export const salonCreate = salonFields
  .partial()
  .required({ name: true })
  .extend({
    id: uuid.optional(),
    clientId: uuid.optional(),
    client: clientCreate.optional(),
    status: z.enum(['lead', 'trial', 'active', 'paused']).optional(),
    /** Primary domain, e.g. "barberhouse.ro". */
    domain: z.union([z.literal(''), domainName]).optional(),
  })
  .strict()
  .refine((v) => !!v.clientId !== !!v.client, { message: 'Pick a client or enter a new one.', path: ['clientId'] });

/** Status is changed only through POST /salons/:id/status (it writes the history). */
export const salonPatch = salonFields.partial().strict();

export const statusChange = z
  .object({
    status: z.enum(SALON_STATUSES),
    reason: text(1000).optional(),
    changedOn: optionalDate.optional(),
  })
  .strict()
  .refine((v) => v.status !== 'churned' || !!v.reason?.trim(), {
    message: 'Say why the salon left (used for retention).',
    path: ['reason'],
  });

// ---- domains ----

export const domainFields = z.object({
  domain: domainName,
  isPrimary: z.boolean(),
  registrar: text(100),
  expiresOn: optionalDate,
  autoRenew: z.boolean(),
  dnsStatus: z.enum(DNS_STATUSES),
  sslStatus: z.enum(SSL_STATUSES),
  sslExpiresOn: optionalDate,
  /** Where the login lives in the password manager (label or link). Never the password itself. */
  passwordManagerRef: text(500),
  notes: longText,
});
export const domainCreate = domainFields.partial().required({ domain: true }).extend({ id: uuid.optional() }).strict();
export const domainPatch = domainFields.partial().strict();

// ---- plans & promotions ----

const bani = z.number().int('Money is stored in whole bani.').min(0).max(2_000_000_000);

export const planPatch = z
  .object({
    name: required('Name'),
    monthlyPriceBani: bani,
    oneOffFromBani: bani.nullable(),
    includedSessions: z.number().int().min(0).max(100),
    sessionMinutes: z.number().int().min(1).max(600),
    includesSms: z.boolean(),
    minTermMonths: z.number().int().min(0).max(120),
    extraHourlyBani: bani,
    isActive: z.boolean(),
  })
  .partial()
  .strict();

const promotionFields = z.object({
  code: z.string().regex(/^[a-z0-9_]{2,40}$/, 'Use 2–40 lower-case letters, digits or _.'),
  name: required('Name'),
  freeMonths: z.number().int().min(0).max(36).nullable(),
  discountPct: z.number().int().min(1).max(100).nullable(),
  maxSalons: z.number().int().min(1).max(100_000).nullable(),
  validFrom: optionalDate,
  validTo: optionalDate,
  isActive: z.boolean(),
  notes: longText,
});
export const promotionCreate = promotionFields.partial().required({ code: true, name: true }).strict();
export const promotionPatch = promotionFields.partial().strict();
