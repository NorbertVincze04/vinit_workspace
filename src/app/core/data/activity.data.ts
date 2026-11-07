/** How activity-log entries read and where they lead (activity feed, salon timeline, Overview). */

export interface ActivityEntry {
  id: string;
  occurredAt: string;
  entityType: string;
  entityId?: string | null;
  action: string;
  summary: string;
  salonId?: string | null;
  salonName?: string | null;
  userName: string | null;
}

const ENTITY: Record<string, { label: string; route: string; tab?: string }> = {
  salons: { label: 'Salon', route: '/tools/salons' },
  clients: { label: 'Client', route: '/tools/clients' },
  domains: { label: 'Domain', route: '/tools/salons' },
  leads: { label: 'Lead', route: '/tools/leads' },
  subscriptions: { label: 'Subscription', route: '/tools/subscriptions', tab: 'billing' },
  payments: { label: 'Payment', route: '/tools/subscriptions', tab: 'billing' },
  plans: { label: 'Plan', route: '/tools/subscriptions' },
  promotions: { label: 'Promotion', route: '/tools/subscriptions' },
  onboardings: { label: 'Onboarding', route: '/tools/onboarding', tab: 'onboarding' },
  'onboarding-steps': { label: 'Onboarding step', route: '/tools/onboarding', tab: 'onboarding' },
  'onboarding-template': { label: 'Onboarding checklist', route: '/tools/onboarding' },
  tickets: { label: 'Ticket', route: '/tools/support', tab: 'support' },
  'time-entries': { label: 'Time', route: '/tools/support', tab: 'support' },
  contracts: { label: 'Contract', route: '/tools/contracts', tab: 'contracts' },
  'feature-requests': { label: 'Feature request', route: '/tools/features' },
  kpis: { label: 'KPIs', route: '/tools/kpis' },
  deadlines: { label: 'Deadline', route: '/tools/calendar' },
  wiki: { label: 'Wiki', route: '/tools/wiki' },
  infra: { label: 'Infra', route: '/tools/infra' },
  files: { label: 'File', route: '/tools/files', tab: 'contracts' },
  tasks: { label: 'Task', route: '/tools/tasks' },
  goals: { label: 'Goal', route: '/tools/tasks' },
  roadmap: { label: 'Roadmap', route: '/tools/roadmap' },
  setting: { label: 'Setting', route: '/' },
  import: { label: 'Import', route: '/tools/salons' },
  'marketing/posts': { label: 'Marketing post', route: '/tools/marketing' },
  'finances/accounts': { label: 'Account', route: '/tools/finances' },
  'finances/holdings': { label: 'Investment', route: '/tools/finances' },
  'finances/recurring': { label: 'Recurring payment', route: '/tools/finances' },
  'finances/transactions': { label: 'Transaction', route: '/tools/finances' },
  'finances/budgets': { label: 'Budget', route: '/tools/finances' },
};

const ACTION: Record<string, string> = {
  created: 'added',
  updated: 'edited',
  deleted: 'removed',
  replaced: 'replaced from a backup',
  status_changed: 'status changed',
  stage_changed: 'moved',
  converted: 'converted to a salon',
  went_live: 'went live',
  materials_received: 'materials received',
  trial_converted: 'trial converted',
  price_change: 'price changed',
  past_due: 'marked past due',
  uploaded: 'uploaded',
  done: 'done',
  undone: 'reopened',
  paid: 'marked paid',
  reopened: 'reopened',
  generated: 'created for the month',
};

/** "salons" + "status_changed" → "Salon · status changed". */
export function activityLabel(entry: Pick<ActivityEntry, 'entityType' | 'action'>): string {
  const what = ENTITY[entry.entityType]?.label ?? entry.entityType;
  const did = ACTION[entry.action] ?? entry.action.replace(/^contact_/, 'contact: ').replace(/_/g, ' ');
  return `${what} · ${did}`;
}

/** Where an entry leads: the salon's tab when it belongs to a salon, else the tool. */
export function activityLink(entry: ActivityEntry): { route: string; query?: Record<string, string> } {
  const e = ENTITY[entry.entityType];
  if (entry.salonId) return { route: `/tools/salons/${entry.salonId}`, query: e?.tab ? { tab: e.tab } : undefined };
  return { route: e?.route ?? '/' };
}

export const ACTIVITY_AREAS: readonly { value: string; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'sales', label: 'Sales & marketing' },
  { value: 'salons', label: 'Salons & support' },
  { value: 'money', label: 'Money' },
  { value: 'planning', label: 'Planning' },
  { value: 'operations', label: 'Operations' },
];
