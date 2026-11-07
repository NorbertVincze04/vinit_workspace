import { StatusTone } from '../../../shared/ui';

export type RequestStatus = 'new' | 'planned' | 'in_progress' | 'shipped' | 'declined';

export const REQUEST_STATUSES: readonly { value: RequestStatus; label: string; tone: StatusTone }[] = [
  { value: 'new', label: 'New', tone: 'info' },
  { value: 'planned', label: 'Planned', tone: 'teal' },
  { value: 'in_progress', label: 'In progress', tone: 'warn' },
  { value: 'shipped', label: 'Shipped', tone: 'ok' },
  { value: 'declined', label: 'Declined', tone: 'neutral' },
];

export const requestStatus = (s: string) => REQUEST_STATUSES.find((x) => x.value === s) ?? REQUEST_STATUSES[0];

/** API row of GET /feature-requests (money in bani). */
export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  status: RequestStatus;
  roadmapStepId: string | null;
  roadmapStepText: string | null;
  roadmapPhase: string | null;
  shippedOn: string | null;
  createdAt: string;
  votes: number;
  salonVotes: number;
  /** MRR of the paying salons that asked for it. */
  mrrBani: number;
  tickets: number;
  voteList?: Vote[];
  ticketList?: { id: string; number: number; title: string; status: string; salonName: string }[];
}

export interface Vote {
  id: string;
  salonId: string | null;
  leadId: string | null;
  salonName: string | null;
  salonStatus: string | null;
  leadName: string | null;
  leadStage: string | null;
  note: string;
  votedOn: string;
}

export interface RoadmapStepRow {
  id: string;
  phase: string;
  text: string;
  position: number;
}
