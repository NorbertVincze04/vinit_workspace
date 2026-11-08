/**
 * Year-1 financial assumptions from the business plan (section 5).
 * Every number in the app (home page, roadmap counter) is derived from here.
 *
 * Operational costs are the sum of the plan's own line items (ads 500, accounting 500, lawyer 500,
 * software 980, Twilio 300, utilities 300 = 3.080 RON); the plan's text says 2.600, which doesn't add up.
 */
export const FINANCE = {
  shareCapital: 1_000,
  initialInvestment: 24_585,
  monthlyOperational: 3_080,
  monthlySalaries: 3_780,
  monthlyCosts: 6_860,
  adsBudget: 500,

  standardPrice: 150,
  premiumPrice: 200,
  customFrom: 1_000,
  extraWorkHourly: 100,

  betaSalons: 5,
  month9Checkpoint: 20,
  year1Salons: 50,
  marketSize: 500,
  nationalMarket: 2_500,

  fundingTargetEur: 20_000,
  fundingTargetRon: 100_000,
} as const;

/** Salons on the Standard plan needed to cover monthly costs (46: 46 × 150 = 6.900 ≥ 6.860). */
export const BREAK_EVEN_SALONS = Math.ceil(FINANCE.monthlyCosts / FINANCE.standardPrice);

/** Monthly recurring income at the Year-1 goal, Standard price only (7.500 RON). */
export const YEAR1_MRR = FINANCE.year1Salons * FINANCE.standardPrice;
