/** API shapes of GET /kpis and /kpis/history (money in bani). */
export interface MonthKpis {
  month: string;
  paying: number;
  mrrBani: number;
  salons: { active: number; trial: number; paused: number; churned: number; lead: number };
  newPaying: number;
  churned: number;
  payingAtStart: number;
  retentionPct: number | null;
  retentionYtdPct: number | null;
  trialsEnded: number;
  trialsConverted: number;
  trialToPaidPct: number | null;
  onboardingsLive: number;
  onboardingsWithin48h: number;
  avgOnboardingHours: number | null;
  leadsNew: number;
  leadsConverted: number;
  leadsLost: number;
  pipeline: Record<string, number>;
  snapshot?: boolean;
}

export interface Targets {
  breakEvenSalons: number;
  monthlyCostsBani: number;
  year1Salons: number;
  year1MrrBani: number;
  retentionPct: number;
  onboardingHours: number;
  earlyBirdLimit: number;
  smsMonthlyBudget: number;
  operationalCostsBani: number;
}

/** "71,4%" or "—" when there was nothing to measure. */
export const pctText = (v: number | null): string => (v === null ? '—' : `${v.toLocaleString('ro-RO')}%`);
