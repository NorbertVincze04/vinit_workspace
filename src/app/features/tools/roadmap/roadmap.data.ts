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
  text:
    `Check the count at the end of Month 9. Under ${FINANCE.month9Checkpoint} salons means it is time for Plan B: ` +
    `offer multi-location management to 5 to 10 salon chains at ${formatNumber(FINANCE.customFrom)} RON a month or more, ` +
    `instead of ${FINANCE.standardPrice} RON plans for many small salons.`,
  note:
    `Income is counted at the ${FINANCE.standardPrice} RON Standard price. ` +
    `Every Premium salon (${FINANCE.premiumPrice} RON) lowers the number you need.`,
};
