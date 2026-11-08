import { COSTS_CONTENT } from './costs';
import { MARKETING_CONTENT } from './marketing';
import { ROADMAP_CONTENT } from './roadmap';
import { TASKS_CONTENT } from './tasks';
import { ONBOARDING_CONTENT } from './onboarding';
import { WIKI_CONTENT } from './wiki';

/** [English, Romanian] pairs of the built-in content, per area. */
export const CONTENT_PAIRS: readonly (readonly [string, string])[] = [...ONBOARDING_CONTENT, ...WIKI_CONTENT, ...COSTS_CONTENT, ...MARKETING_CONTENT, ...ROADMAP_CONTENT, ...TASKS_CONTENT];
