/**
 * Business-plan targets the dashboards measure against (one place, used by KPIs and alerts).
 * Money in bani.
 */
export const TARGETS = {
  /** 43 salons on Standard cover the 6,380 RON monthly costs. */
  breakEvenSalons: 43,
  monthlyCostsBani: 638_000,
  year1Salons: 50,
  year1MrrBani: 750_000,
  retentionPct: 70,
  onboardingHours: 48,
  earlyBirdLimit: 50,
  /** Twilio budget: ~1,500 SMS a month (300 RON at 0.20 RON). */
  smsMonthlyBudget: 1500,
  /** Operational costs per month in the plan (hosting, tools, accounting…). */
  operationalCostsBani: 260_000,
} as const;
