import { Phase } from '../models';
import { t } from '../i18n/i18n';

/** The four Year-1 phases, shared by the Roadmap and Tasks tools. */
export const PHASES: readonly Phase[] = [
  { id: 'build', name: 'Build', months: [1, 3], goal: 'Set up the company and ship a version you can show.' },
  { id: 'prove', name: 'Prove', months: [4, 6], goal: 'Get five salons using it for real.' },
  { id: 'sell', name: 'Sell', months: [7, 9], goal: 'Turn demos and beta users into paying salons.' },
  { id: 'scale', name: 'Scale', months: [10, 12], goal: 'Cross break-even and keep your customers.' },
];

export function phaseRange(phase: Pick<Phase, 'months'>): string {
  return t('Months {from}–{to}', { from: phase.months[0], to: phase.months[1] });
}
