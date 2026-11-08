import { CONTENT_PAIRS } from './content/index';
import { lang } from './i18n';

/**
 * Built-in content (the Year-1 tasks, goals, roadmap, wiki pages, onboarding checklist, plans and the
 * marketing strategy) follows the language until someone edits it: the text is matched exactly against
 * the original English and Romanian versions, so anything changed by hand shows as written.
 *
 *   tc('Register the SRL at ONRC')  → "Înregistrează SRL-ul la ONRC" in Romanian
 *   tc('comisioane')                → "commissions" in English (keywords are Romanian originals)
 */
const TO_RO = new Map<string, string>();
const TO_EN = new Map<string, string>();
for (const [en, ro] of CONTENT_PAIRS) {
  TO_RO.set(en, ro);
  TO_EN.set(ro, en);
}

export function tc(text: string | null | undefined): string {
  if (!text) return '';
  return (lang() === 'ro' ? TO_RO.get(text) : TO_EN.get(text)) ?? text;
}
