import { FINANCE } from '../../../core/data/finance.data';
import { formatNumber } from '../../../core/utils/format';


/** Extras on the Roadmap page. The phases and steps of each year live in the database (Roadmap › Edit roadmap). */

export const WEEKLY_RHYTHM: readonly { value: number; label: string }[] = [
  { value: 10, label: 'Outreach messages' },
  { value: 2, label: 'Demos' },
  { value: 2, label: 'Posts' },
  { value: 1, label: 'Check-in with a live salon' },
];

export const PLAN_B = {
  title: 'If sales run slow',
  text: 'Check the count at the end of Month 9. Under {checkpoint} salons means it is time for Plan B: offer multi-location management to 5 to 10 salon chains at {custom} RON a month or more, instead of {standard} RON plans for many small salons.',
  note: 'Income is counted at the {standard} RON Standard price. Every Premium salon ({premium} RON) lowers the number you need.',
  params: { checkpoint: FINANCE.month9Checkpoint, custom: formatNumber(FINANCE.customFrom), standard: FINANCE.standardPrice, premium: FINANCE.premiumPrice },
};
