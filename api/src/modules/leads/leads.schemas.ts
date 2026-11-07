import { z } from 'zod';
import { longText, optionalDate, optionalEmail, optionalTimestamp, phone, text, timestamp, uuid, uuidRef } from '../../lib/schemas.js';
import { clientCreate, salonFields } from '../salons/salons.schemas.js';
import { domainName } from '../../lib/schemas.js';

export const LEAD_STAGES = ['contacted', 'replied', 'demo_booked', 'trial', 'paying', 'lost'] as const;
export const LEAD_SOURCES = ['instagram_dm', 'visit', 'email', 'referral', 'phone', 'facebook', 'event', 'other'] as const;
export const LOST_REASONS = ['price', 'no_reply', 'happy_with_current', 'not_ready', 'closed', 'other'] as const;
export const ACTIVITY_KINDS = ['note', 'dm', 'call', 'email', 'visit'] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

/** Stages a lead can be in before it becomes a salon (trial and paying follow the salon). */
export const OPEN_STAGES = ['contacted', 'replied', 'demo_booked', 'lost'] as const;

const lostRule = <T extends { stage?: string; lostReason?: string | null }>(v: T) => v.stage !== 'lost' || !!v.lostReason;
const lostMessage = { message: 'Pick why the lead was lost.', path: ['lostReason'] };

export const leadFields = z.object({
  businessName: z.string().trim().min(1, 'Business name is required.').max(200),
  contactName: text(200),
  phone,
  email: optionalEmail,
  instagram: text(200),
  website: text(500),
  city: text(100),
  employees: z.number().int().min(0).max(10_000).nullable(),
  services: text(2000),
  source: z.enum(LEAD_SOURCES),
  sourceDetail: text(500),
  nextFollowUpOn: optionalDate,
  demoAt: optionalTimestamp,
  ownerUserId: uuidRef,
  interestedPlanId: uuidRef,
  referredBySalonId: uuidRef,
  lostReason: z.enum(LOST_REASONS).nullable(),
  lostNote: text(1000),
  notes: longText,
});

export const leadCreate = leadFields
  .partial()
  .required({ businessName: true })
  .extend({ id: uuid.optional(), stage: z.enum(OPEN_STAGES).optional() })
  .strict()
  .refine(lostRule, lostMessage);

/** Stage and position change only through POST /leads/:id/move. */
export const leadPatch = leadFields.partial().strict();

export const leadMove = z
  .object({
    stage: z.enum(LEAD_STAGES),
    /** Index in the target column (0 = top). Default: last. */
    position: z.number().int().min(0).max(100_000).optional(),
    lostReason: z.enum(LOST_REASONS).optional(),
    lostNote: text(1000).optional(),
  })
  .strict();

export const activityCreate = z
  .object({
    kind: z.enum(ACTIVITY_KINDS),
    body: z.string().trim().min(1, 'Write what happened.').max(5000),
    occurredAt: timestamp.optional(),
  })
  .strict();

export const leadConvert = z
  .object({
    clientId: uuid.optional(),
    client: clientCreate.optional(),
    /** Defaults come from the lead (name, city, interested plan, referrer). */
    salon: salonFields
      .partial()
      .extend({ status: z.enum(['trial', 'active']).optional(), domain: z.union([z.literal(''), domainName]).optional() })
      .strict()
      .optional(),
  })
  .strict()
  .refine((v) => !!v.clientId !== !!v.client, { message: 'Pick a client or enter a new one.', path: ['clientId'] });

export const leadImport = z
  .object({
    rows: z
      .array(leadFields.partial().required({ businessName: true }).extend({ stage: z.enum(OPEN_STAGES).optional() }).strict().refine(lostRule, lostMessage))
      .min(1)
      .max(2000),
  })
  .strict();

export const leadListQuery = z.object({
  stage: z.enum(LEAD_STAGES).optional(),
  q: z.string().max(200).optional(),
  /** Follow-ups: overdue (before today), today (up to today), week (next 7 days). */
  due: z.enum(['overdue', 'today', 'week']).optional(),
});
