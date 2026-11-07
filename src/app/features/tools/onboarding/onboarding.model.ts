import { StatusTone } from '../../../shared/ui';

export const ONBOARDING_HOURS = 48;

export type OnboardingStatus = 'in_progress' | 'blocked' | 'done';
export type StepCategory = 'materials' | 'session' | 'setup' | 'launch';

export const STEP_CATEGORIES: readonly { value: StepCategory; label: string }[] = [
  { value: 'materials', label: 'Materials from the client' },
  { value: 'session', label: 'Sessions (included, 30 min)' },
  { value: 'setup', label: 'Setup' },
  { value: 'launch', label: 'Launch' },
];

export interface OnboardingStep {
  id: string;
  position: number;
  title: string;
  description: string;
  category: StepCategory;
  doneAt: string | null;
  doneByName: string | null;
  note: string;
}

/** API row (GET /onboardings, /onboardings/:id) with the 48h clock computed by the server. */
export interface Onboarding {
  id: string;
  salonId: string;
  salonName: string;
  signedAt: string;
  materialsReceivedAt: string | null;
  wentLiveAt: string | null;
  status: OnboardingStatus;
  blockedReason: string;
  notes: string;
  targetLiveAt: string | null;
  /** Hours from materials to go-live (or to now while open); null until the materials arrive. */
  hoursUsed: number | null;
  late: boolean;
  hoursWaitingOnClient: number;
  stepsTotal: number;
  stepsDone: number;
  steps?: OnboardingStep[];
}

export interface TemplateItem {
  title: string;
  description: string;
  category: StepCategory;
}

export interface Clock {
  text: string;
  tone: StatusTone;
  /** Share of the 48h used (0–100+). */
  percent: number;
}

const days = (h: number): string => (h >= 48 ? `${Math.floor(h / 24)} days` : `${Math.round(h)}h`);

/** "31h left", "6h over 48h", "Live in 40h", "Waiting for materials (3 days)". */
export function clockOf(o: Pick<Onboarding, 'status' | 'hoursUsed' | 'late' | 'hoursWaitingOnClient' | 'materialsReceivedAt'>): Clock {
  if (!o.materialsReceivedAt || o.hoursUsed === null) {
    return { text: `Waiting for materials (${days(o.hoursWaitingOnClient)})`, tone: 'neutral', percent: 0 };
  }
  const used = o.hoursUsed;
  const percent = Math.round((used / ONBOARDING_HOURS) * 100);
  if (o.status === 'done') {
    return o.late
      ? { text: `Live in ${Math.round(used)}h (over ${ONBOARDING_HOURS}h)`, tone: 'bad', percent }
      : { text: `Live in ${Math.round(used)}h`, tone: 'ok', percent };
  }
  if (o.late) return { text: `${Math.round(used - ONBOARDING_HOURS)}h over ${ONBOARDING_HOURS}h`, tone: 'bad', percent };
  const left = ONBOARDING_HOURS - used;
  return { text: `${Math.max(0, Math.floor(left))}h left`, tone: left <= 12 ? 'warn' : 'info', percent };
}

export const statusOf = (o: Pick<Onboarding, 'status'>): { label: string; tone: StatusTone } =>
  o.status === 'done' ? { label: 'Live', tone: 'ok' } : o.status === 'blocked' ? { label: 'Blocked', tone: 'bad' } : { label: 'In progress', tone: 'info' };
