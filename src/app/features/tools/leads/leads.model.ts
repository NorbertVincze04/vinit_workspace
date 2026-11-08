import { FieldMap, field } from '../../../core/api/api-fields';
import { Entity } from '../../../core/models';
import { StatusTone } from '../../../shared/ui';
import { t } from '../../../core/i18n/i18n';

export type LeadStage = 'contacted' | 'replied' | 'demo_booked' | 'trial' | 'paying' | 'lost';
export type LeadSource = 'instagram_dm' | 'visit' | 'email' | 'referral' | 'phone' | 'facebook' | 'event' | 'other';
export type LostReason = 'price' | 'no_reply' | 'happy_with_current' | 'not_ready' | 'closed' | 'other';
export type ActivityKind = 'note' | 'dm' | 'call' | 'email' | 'visit';

export const LEAD_STAGES: readonly { value: LeadStage; label: string; tone: StatusTone; hint: string }[] = [
  { value: 'contacted', label: 'Contacted', tone: 'neutral', hint: 'First message sent' },
  { value: 'replied', label: 'Replied', tone: 'info', hint: 'They answered' },
  { value: 'demo_booked', label: 'Demo booked', tone: 'teal', hint: 'Demo in the calendar' },
  { value: 'trial', label: 'Trial', tone: 'warn', hint: 'Salon on its free months' },
  { value: 'paying', label: 'Paying', tone: 'ok', hint: 'Salon pays' },
  { value: 'lost', label: 'Lost', tone: 'bad', hint: 'Said no or went quiet' },
];

/** Stages a lead can be moved to by hand; trial and paying come from converting it into a salon. */
export const OPEN_STAGES: readonly LeadStage[] = ['contacted', 'replied', 'demo_booked', 'lost'];

export const LEAD_SOURCES: readonly { value: LeadSource; label: string }[] = [
  { value: 'instagram_dm', label: 'Instagram DM' },
  { value: 'visit', label: 'Visit in person' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone call' },
  { value: 'referral', label: 'Referral' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'event', label: 'Event' },
  { value: 'other', label: 'Other' },
];

export const LOST_REASONS: readonly { value: LostReason; label: string }[] = [
  { value: 'price', label: 'Price' },
  { value: 'no_reply', label: 'No reply' },
  { value: 'happy_with_current', label: 'Happy with current tool' },
  { value: 'not_ready', label: 'Not ready yet' },
  { value: 'closed', label: 'Business closed' },
  { value: 'other', label: 'Other' },
];

export const ACTIVITY_KINDS: readonly { value: ActivityKind; label: string }[] = [
  { value: 'dm', label: 'DM' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'visit', label: 'Visit' },
  { value: 'note', label: 'Note' },
];

export const stageInfo = (s: string) => LEAD_STAGES.find((x) => x.value === s) ?? LEAD_STAGES[0];
export const sourceLabel = (s: string): string => t(LEAD_SOURCES.find((x) => x.value === s)?.label ?? s);
export const lostLabel = (s: string): string => t(LOST_REASONS.find((x) => x.value === s)?.label ?? s);
export const kindLabel = (s: string): string =>
  t(s === 'stage_change' ? 'Stage' : (ACTIVITY_KINDS.find((x) => x.value === s)?.label ?? s));

/** A prospect before it becomes a client + salon. */
export interface Lead extends Entity {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  instagram: string;
  website: string;
  city: string;
  /** 0 = unknown. */
  employees: number;
  services: string;
  source: LeadSource;
  sourceDetail: string;
  stage: LeadStage;
  stagePosition: number;
  nextFollowUpOn: string;
  demoAt: string;
  lostReason: LostReason | '';
  lostNote: string;
  ownerUserId: string;
  interestedPlanId: string;
  referredBySalonId: string;
  notes: string;
  // from the server
  convertedSalonId: string;
  convertedClientId: string;
  convertedAt: string;
  ownerName: string;
  interestedPlanName: string;
  convertedSalonName: string;
  lastActivityAt: string;
}

/** Employees: 0 in the app = unknown = null in the API. */
const employees = {
  toApi: (v: unknown) => (Number(v) > 0 ? Math.round(Number(v)) : null),
  fromApi: (v: unknown) => (v == null ? 0 : Number(v)),
};

export const LEAD_FIELD_MAP: FieldMap<Lead> = {
  businessName: field.text(),
  contactName: field.text(),
  phone: field.text(),
  email: field.text(),
  instagram: field.text(),
  website: field.text(),
  city: field.text(),
  employees,
  services: field.text(),
  source: field.text(),
  sourceDetail: field.text(),
  stage: field.readOnly(field.text()),
  stagePosition: field.readOnly(field.int()),
  nextFollowUpOn: field.date(),
  demoAt: field.timestamp(),
  lostReason: field.ref(),
  lostNote: field.text(),
  ownerUserId: field.ref(),
  interestedPlanId: field.ref(),
  referredBySalonId: field.ref(),
  notes: field.text(),
  convertedSalonId: field.readOnly(field.ref()),
  convertedClientId: field.readOnly(field.ref()),
  convertedAt: field.readOnly(field.timestamp()),
  ownerName: field.readOnly(field.text()),
  interestedPlanName: field.readOnly(field.text()),
  convertedSalonName: field.readOnly(field.text()),
  lastActivityAt: field.readOnly(field.timestamp()),
};

export interface LeadActivity {
  id: string;
  kind: ActivityKind | 'stage_change';
  body: string;
  fromStage: LeadStage | null;
  toStage: LeadStage | null;
  occurredAt: string;
  userName: string | null;
}

export interface LeadFilters {
  q: string;
  /** 'all' | 'overdue' | 'today' | 'week' | 'none' (no follow-up planned) */
  due: string;
}
