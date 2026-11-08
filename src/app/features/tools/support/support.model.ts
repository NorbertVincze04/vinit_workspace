import { StatusTone } from '../../../shared/ui';
import { t } from '../../../core/i18n/i18n';

export type TicketType = 'bug' | 'change_request' | 'question';
export type TicketStatus = 'open' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type EntryKind = 'included_session' | 'billable' | 'internal';

interface Labelled<V extends string> {
  value: V;
  label: string;
  tone: StatusTone;
}

export const TICKET_STATUSES: readonly Labelled<TicketStatus>[] = [
  { value: 'open', label: 'Open', tone: 'info' },
  { value: 'in_progress', label: 'In progress', tone: 'teal' },
  { value: 'waiting_client', label: 'Waiting on client', tone: 'warn' },
  { value: 'resolved', label: 'Resolved', tone: 'ok' },
  { value: 'closed', label: 'Closed', tone: 'neutral' },
];
export const OPEN_STATUSES: readonly TicketStatus[] = ['open', 'in_progress', 'waiting_client'];

export const TICKET_TYPES: readonly { value: TicketType; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'change_request', label: 'Change request' },
  { value: 'question', label: 'Question' },
];

export const PRIORITIES: readonly Labelled<Priority>[] = [
  { value: 'urgent', label: 'Urgent', tone: 'bad' },
  { value: 'high', label: 'High', tone: 'warn' },
  { value: 'normal', label: 'Normal', tone: 'neutral' },
  { value: 'low', label: 'Low', tone: 'neutral' },
];

export const CHANNELS: readonly { value: string; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'in_person', label: 'In person' },
  { value: 'other', label: 'Other' },
];

export const ENTRY_KINDS: readonly { value: EntryKind; label: string; hint: string }[] = [
  { value: 'included_session', label: 'Included session', hint: 'One meeting from the plan (Standard/Premium 2, Custom 3)' },
  { value: 'billable', label: 'Billable', hint: 'Extra work, 100 RON/h, exact minutes' },
  { value: 'internal', label: 'Internal', hint: 'Our time, not billed' },
];

export const ticketStatus = (s: string) => TICKET_STATUSES.find((x) => x.value === s) ?? TICKET_STATUSES[0];
export const priorityInfo = (p: string) => PRIORITIES.find((x) => x.value === p) ?? PRIORITIES[2];
export const typeLabel = (type: string): string => t(TICKET_TYPES.find((x) => x.value === type)?.label ?? type);
export const entryKindLabel = (k: string): string => t(ENTRY_KINDS.find((x) => x.value === k)?.label ?? k);
export const ticketNo = (n: number): string => `T-${String(n).padStart(4, '0')}`;

/** "95 min" → "1h 35m". */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

/** API row of GET /tickets. */
export interface Ticket {
  id: string;
  number: number;
  salonId: string;
  salonName: string;
  title: string;
  description: string;
  type: TicketType;
  status: TicketStatus;
  priority: Priority;
  reportedVia: string;
  assigneeId: string | null;
  assigneeName: string | null;
  openedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  minutesLogged: number;
  featureRequestId: string | null;
  featureRequestTitle: string | null;
}

/** API row of GET /time-entries (money in bani). */
export interface TimeEntry {
  id: string;
  salonId: string;
  salonName: string;
  ticketId: string | null;
  ticketNumber: number | null;
  ticketTitle: string | null;
  onboardingId: string | null;
  userName: string | null;
  workedOn: string;
  minutes: number;
  kind: EntryKind;
  rateBani: number;
  amountBani: number;
  description: string;
  billedPaymentId: string | null;
}

/** GET /salons/:id/sessions */
export interface Sessions {
  planName: string | null;
  included: number;
  used: number;
  remaining: number;
  sessionMinutes: number;
  extraHourlyBani: number;
  sessionMinutesUsed: number;
  unbilledMinutes: number;
  unbilledBani: number;
  billableMinutes: number;
  internalMinutes: number;
}

/** GET /salons/:id/overview → support */
export interface SalonSupport {
  sessions: Sessions;
  tickets: Ticket[];
  entries: TimeEntry[];
}
