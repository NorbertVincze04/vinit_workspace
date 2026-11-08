import { formatDate } from '../utils/date';
import { tc } from './content';
import { countOf, lang, t } from './i18n';

/**
 * The API answers in English: error messages, billing warnings, notifications, activity summaries and
 * the titles of deadlines it generates. Fixed texts are translated by the dictionary (ro/server.ts);
 * texts with names, numbers or dates in them are matched here.
 */
const d = (iso: string): string => formatDate(iso) || iso;
const at = (time: string | undefined): string => (time ? ' ' + t('at {time}', { time }) : '');

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  // ---- errors ----
  [/^(.+) not found\.$/, (m) => t('{what} not found.', { what: t(m[1]) })],
  [/^Use at most (\d+) characters\.$/, (m) => t('Use at most {n} characters.', { n: m[1] })],
  [/^Use at least (\d+) characters\.$/, (m) => t('Use at least {n} characters.', { n: m[1] })],
  [/^(.+) is no longer offered\.$/, (m) => t('{name} is no longer offered.', { name: m[1] })],
  [/^All (\d+) (.+) places are taken\.$/, (m) => t('All {n} {name} places are taken.', { n: m[1], name: m[2] })],
  [/^All (\d+) included sessions are used\.$/, (m) => t('All {n} included sessions are used.', { n: m[1] })],
  [/^Year (\d+) has (\d+) content items?: delete or move them first\.$/, (m) => t('Year {year} has {n} content item(s): delete or move them first.', { year: m[1], n: m[2] })],
  [/^The workspace already has (\d+) active users\.$/, (m) => t('The workspace already has {n} active users.', { n: m[1] })],
  [/^Unknown setting "(.+)"\.$/, (m) => t('Unknown setting "{key}".', { key: m[1] })],
  [/^Someone saved this page while you were editing \(now version (\d+)\)\. Copy your text, reload and apply it again\.$/, (m) => t('Someone saved this page while you were editing (now version {n}). Copy your text, reload and apply it again.', { n: m[1] })],
  [/^The (.+) integration is configured but not built yet\. Issue the invoice in (.+) by hand for now\.$/, (m) => t('The {name} integration is configured but not built yet. Issue the invoice in {name} by hand for now.', { name: m[1] })],
  [/^A (\w+) subscription can’t be changed\.(.*)$/, (m) => t('A {status} subscription can’t be changed.', { status: t(m[1]) }) + (m[2] ? ' ' + translateServer(m[2].trim()) : '')],
  [/^Too small: expected string to have >=(\d+) characters?$/, (m) => t('Use at least {n} characters.', { n: m[1] })],
  [/^Too big: expected string to have <=(\d+) characters?$/, (m) => t('Use at most {n} characters.', { n: m[1] })],
  [/^Too small: expected number to be >=(-?[\d.]+)$/, (m) => t('Must be at least {n}.', { n: m[1] })],
  [/^Too big: expected number to be <=(-?[\d.]+)$/, (m) => t('Must be at most {n}.', { n: m[1] })],
  [/^Invalid input: expected (\w+), received (\w+)$/, () => t('This value has the wrong type.')],
  [/^Invalid option: expected one of .+$/, () => t('Choose one of the options.')],

  // ---- billing warnings ----
  [/^Trial ended on (\S+): convert it or follow up$/, (m) => t('Trial ended on {date}: convert it or follow up', { date: d(m[1]) })],
  [/^Trial ends on (\S+)$/, (m) => t('Trial ends on {date}', { date: d(m[1]) })],
  [/^([\d.]+) RON was due on (\S+)$/, (m) => t('{amount} RON was due on {date}', { amount: m[1], date: d(m[2]) })],
  [/^Minimum term ends on (\S+): time to talk about renewal$/, (m) => t('Minimum term ends on {date}: time to talk about renewal', { date: d(m[1]) })],
  [/^Salon is (\w+) but has no subscription$/, (m) => t('Salon is {status} but has no subscription', { status: t(m[1]) })],
  [/^All (\d+) Early Bird places are taken$/, (m) => t('All {n} Early Bird places are taken', { n: m[1] })],
  [/^Only (\d+) Early Bird places left$/, (m) => t('Only {n} Early Bird places left', { n: m[1] })],

  // ---- generated deadline titles ----
  [/^Domain (.+) expires( \(auto-renew: check the card\))?$/, (m) => t('Domain {domain} expires', { domain: m[1] }) + (m[2] ? ' ' + t('(auto-renew: check the card)') : '')],
  [/^SSL certificate of (.+) expires$/, (m) => t('SSL certificate of {domain} expires', { domain: m[1] })],
  [/^(.+): contract (.+) renewal( \(renews automatically\))?$/, (m) => t('{salon}: contract {number} renewal', { salon: m[1], number: m[2] }) + (m[3] ? ' ' + t('(renews automatically)') : '')],
  [/^(.+): free months end \(convert to paid\)$/, (m) => t('{salon}: free months end (convert to paid)', { salon: m[1] })],
  [/^(.+): minimum term ends \(talk about renewal\)$/, (m) => t('{salon}: minimum term ends (talk about renewal)', { salon: m[1] })],
  [/^(.+) renews$/, (m) => t('{service} renews', { service: m[1] })],

  // ---- notifications ----
  [/^(.+): onboarding is over (\d+)h$/, (m) => t('{salon}: onboarding is over {h}h', { salon: m[1], h: m[2] })],
  [/^(.+): onboarding blocked$/, (m) => t('{salon}: onboarding blocked', { salon: m[1] })],
  [/^Follow up (.+)$/, (m) => t('Follow up {name}', { name: m[1] })],
  [/^Was due (\d{4}-\d{2}-\d{2})(?: at (\S+))?$/, (m) => t('Was due {date}', { date: d(m[1]) }) + at(m[2])],
  [/^Due today(?: at (\S+))?$/, (m) => t('Due today') + at(m[1])],
  [/^Due tomorrow(?: at (\S+))?$/, (m) => t('Due tomorrow') + at(m[1])],
  [/^Due in (\d+) days \((\S+?)(?: at (\S+))?\)$/, (m) => t('Due in {days} ({date})', { days: countOf(Number(m[1]), 'day', 'days'), date: d(m[2]) + at(m[3]) })],
  [/^SMS: (\d+)% of the monthly budget used$/, (m) => t('SMS: {pct}% of the monthly budget used', { pct: m[1] })],
  [/^(\d+) of (\d+) SMS$/, (m) => t('{sent} of {budget} SMS', { sent: m[1], budget: m[2] })],
  [/^Last backup (\d+) days ago$/, (m) => t('Last backup {days} ago', { days: countOf(Number(m[1]), 'day', 'days') })],

  // ---- activity summaries ----
  [/^Imported (\d+) (.+)$/, (m) => t('Imported {n} {what}', { n: m[1], what: t(m[2]) })],
  [/^Year (\d+) (plan|goals|marketing plan|marketing strategy)$/, (m) => t(`Year {n} ${m[2]}`, { n: m[1] })],
  [/^Year (\d+): phase (.+)$/, (m) => t('Year {n}: phase {name}', { n: m[1], name: t(m[2]) })],
  [/^(.+) became a salon \((.+)\)$/, (m) => t('{name} became a salon ({stage})', { name: m[1], stage: t(m[2]) })],
  [/^(\d+) payments due for (\S+)$/, (m) => t('{n} payments due for {month}', { n: m[1], month: m[2] })],
  [/^(.+): onboarding started$/, (m) => t('{salon}: onboarding started', { salon: m[1] })],
  [/^(.+) is live, (\d+)h after the materials(?: \(over (\d+)h\))?$/, (m) => t('{salon} is live, {h}h after the materials', { salon: m[1], h: m[2] }) + (m[3] ? ' ' + t('(over {h}h)', { h: m[3] }) : '')],
  [/^(.+): extra work billed, (\d+) min = ([\d.]+) RON$/, (m) => t('{salon}: extra work billed, {min} min = {amount} RON', { salon: m[1], min: m[2], amount: m[3] })],
  [/^KPIs of (\S+) recomputed$/, (m) => t('KPIs of {month} recomputed', { month: m[1] })],
  [/^Checklist template: (\d+) steps$/, (m) => t('Checklist template: {n} steps', { n: m[1] })],
  [/^Asked for: (.+)$/, (m) => t('Asked for: {title}', { title: m[1] })],
  [/^Shipped what they asked for: (.+)$/, (m) => t('Shipped what they asked for: {title}', { title: m[1] })],
  [/^Old Clients moved: (\d+) leads, (\d+) salons$/, (m) => t('Old Clients moved: {leads} leads, {salons} salons', { leads: m[1], salons: m[2] })],
  [/^(\d+) added, (\d+) removed$/, (m) => t('{added} added, {removed} removed', { added: m[1], removed: m[2] })],
  [/^(.+): ([\d.]+) RON paid on (\S+)$/, (m) => t('{salon}: {amount} RON paid on {date}', { salon: m[1], amount: m[2], date: d(m[3]) })],
  [/^([\d.]+) RON back to due$/, (m) => t('{amount} RON back to due', { amount: m[1] })],
  [/^(.+): ([\d.]+) RON due on (\S+)$/, (m) => t('{salon}: {amount} RON due on {date}', { salon: m[1], amount: m[2], date: d(m[3]) })],
  [/^(.+): version (\d+) restored$/, (m) => t('{title}: version {n} restored', { title: m[1], n: m[2] })],
  [/^Step (\S+)$/, (m) => t('Step {id}', { id: m[1] })],
  // "contacted → lost", "active → churned (Moved to a marketplace app)"
  [/^([a-z_]+) → ([a-z_]+)(?: \((.+)\))?$/, (m) => `${t(m[1])} → ${t(m[2])}${m[3] ? ` (${m[3]})` : ''}`],
  // "Standard Barbershop, 150 RON / monthly, trial until 2027-02-06"
  [/^(.+), ([\d.]+) RON \/ (monthly|quarterly|yearly|one_off)(?:, trial until (.+))?$/, (m) =>
    `${tc(m[1])}, ${m[2]} RON / ${t(m[3])}` + (m[4] ? ', ' + t('trial until {date}', { date: m[4] === 'open' ? t('open-ended') : d(m[4]) }) : '')],
  // "cancel · Moved to a marketplace app"
  [/^(cancel|pause|resume|upgrade|downgrade|price|convert|past_due|end|start) · (.+)$/, (m) => `${t(m[1])} · ${m[2]}`],
  // Integrations (Infra)
  [/^Selected, but (.+) (?:is|are) missing\.$/, (m) => t('Selected, but {vars} missing.', { vars: m[1] })],
  [/^Set INVOICE_PROVIDER=(\S+) to use it\. Only one invoice provider is used at a time\.$/, (m) => t('Set INVOICE_PROVIDER={id} to use it. Only one invoice provider is used at a time.', { id: m[1] })],

  // ---- "Salon: message" (notification titles): translate the message part ----
  [/^([^:]{1,120}): (.+)$/, (m) => `${m[1]}: ${translateServer(m[2])}`],
];

export function translateServer(message: string): string {
  if (lang() === 'en' || !message) return message;
  const exact = t(message);
  if (exact !== message) return exact;
  for (const [re, fn] of PATTERNS) {
    const m = message.match(re);
    if (m) return fn(m);
  }
  return message;
}
