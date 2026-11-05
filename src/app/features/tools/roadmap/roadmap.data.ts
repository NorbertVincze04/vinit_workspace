import { BREAK_EVEN_SALONS, FINANCE, YEAR1_MRR } from '../../../core/data/finance.data';
import { PhaseId } from '../../../core/models';
import { formatNumber } from '../../../core/utils/format';

/** Roadmap content: the checklist for each phase. Step ids are what gets saved — keep them stable. */

export interface RoadmapStep {
  id: string;
  text: string;
}

export interface RoadmapPhasePlan {
  phaseId: PhaseId;
  steps: readonly RoadmapStep[];
  milestone: string;
}

export const ROADMAP_PLAN: readonly RoadmapPhasePlan[] = [
  {
    phaseId: 'build',
    steps: [
      { id: 'b1', text: 'Finish the multi-tenant app and the JSON template for new salons' },
      { id: 'b2', text: 'Write a one-page onboarding sheet that lists every feature' },
      { id: 'b3', text: 'Register the SRL and cover GDPR basics' },
      { id: 'b4', text: 'List 30 barbershops in Cluj-Napoca to approach' },
      { id: 'b5', text: 'Start posting on Instagram and announce Early Bird (3 months free)' },
      { id: 'b6', text: 'Prepare the Start-Up Nation 2026 and Innovation Labs applications' },
    ],
    milestone: 'MVP is live and one salon runs on its own domain.',
  },
  {
    phaseId: 'prove',
    steps: [
      { id: 'p1', text: `Onboard ${FINANCE.betaSalons} beta salons in Cluj, each live in under 48 hours` },
      { id: 'p2', text: 'Ship SMS reminders and the waitlist (Twilio)' },
      { id: 'p3', text: 'Hold a feedback call with each beta salon after two weeks' },
      { id: 'p4', text: 'Turn feedback into 3 testimonials and short Reels' },
      { id: 'p5', text: 'Fix the top 5 issues the beta salons report' },
      { id: 'p6', text: 'Launch the Premium Brand upgrade offer' },
    ],
    milestone: `${FINANCE.betaSalons} salons book weekly and 3 testimonials are in hand.`,
  },
  {
    phaseId: 'sell',
    steps: [
      { id: 's1', text: 'Switch on the paid Standard and Premium packages' },
      { id: 's2', text: `Run Instagram, TikTok and Facebook ads (${FINANCE.adsBudget} RON a month)` },
      { id: 's3', text: 'Sponsor or attend a local barbering course' },
      { id: 's4', text: 'Send outreach to larger salons (3+ chairs) outside Cluj' },
      { id: 's5', text: 'Keep every new salon’s setup under 48 hours' },
    ],
    milestone: `${FINANCE.month9Checkpoint} paying salons by the end of Month 9.`,
  },
  {
    phaseId: 'scale',
    steps: [
      { id: 'c1', text: 'Launch the referral offer: bring a salon, get 3 months free' },
      { id: 'c2', text: 'Publish a year in review with hours saved by automations' },
      { id: 'c3', text: 'Check in with every salon to keep retention at 70% or more' },
      { id: 'c4', text: `Reach ${BREAK_EVEN_SALONS} salons (break-even), then ${FINANCE.year1Salons}` },
      { id: 'c5', text: 'Plan next year’s add-ons: online payments, stock, reports' },
    ],
    milestone: `${FINANCE.year1Salons} salons and ${formatNumber(YEAR1_MRR)} RON of monthly recurring income.`,
  },
];

export const WEEKLY_RHYTHM: readonly { value: number; label: string }[] = [
  { value: 10, label: 'Outreach messages' },
  { value: 2, label: 'Demos' },
  { value: 2, label: 'Posts' },
  { value: 1, label: 'Check-in with a live salon' },
];

export const PLAN_B = {
  title: 'If sales run slow',
  text:
    `Check the count at the end of Month 9. Under ${FINANCE.month9Checkpoint} salons means it is time for Plan B: ` +
    `offer multi-location management to 5 to 10 salon chains at ${formatNumber(FINANCE.customFrom)} RON a month or more, ` +
    `instead of ${FINANCE.standardPrice} RON plans for many small salons.`,
  note:
    `Income is counted at the ${FINANCE.standardPrice} RON Standard price. ` +
    `Every Premium salon (${FINANCE.premiumPrice} RON) lowers the number you need.`,
};
