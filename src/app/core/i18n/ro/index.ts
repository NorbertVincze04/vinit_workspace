import { CALENDAR } from './calendar';
import { COMMON } from './common';
import { DASHBOARD } from './dashboard';
import { EXTRA } from './extra';
import { FEATURES_CONTRACTS_WIKI } from './features-contracts-wiki';
import { FINANCES_INFRA } from './finances-infra';
import { LEADS } from './leads';
import { MARKETING } from './marketing';
import { ONBOARDING_SUPPORT } from './onboarding-support';
import { ROADMAP_TASKS } from './roadmap-tasks';
import { SALONS } from './salons';
import { SERVER } from './server';
import { SUBSCRIPTIONS } from './subscriptions';

/** Every area's dictionary (later ones win on duplicates). */
export const RO_AREAS: readonly Record<string, string>[] = [
  SERVER,
  COMMON,
  CALENDAR,
  DASHBOARD,
  LEADS,
  SALONS,
  SUBSCRIPTIONS,
  ONBOARDING_SUPPORT,
  FEATURES_CONTRACTS_WIKI,
  FINANCES_INFRA,
  MARKETING,
  ROADMAP_TASKS,
  EXTRA,
];
