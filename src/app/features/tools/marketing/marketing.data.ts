import { FINANCE } from '../../../core/data/finance.data';
import { SelectOption, StatusTone } from '../../../shared/ui';

/**
 * Marketing plan reference data (business plan § 2.5 and Annex 3).
 * Keywords stay in Romanian because they are used as-is in the content.
 */

export interface MonthPlan {
  /** Element of the communication mix. */
  element: string;
  theme: string;
  keywords: readonly string[];
  /** Planned appearances. */
  target: number;
  where: string;
}

export const MONTH_PLAN: readonly MonthPlan[] = [
  { element: 'Launch ad / Direct marketing', theme: 'Education: Marketplace vs. own brand', keywords: ['comisioane', 'brand propriu', 'aplicație frizerie'], target: 8, where: 'Instagram (Ads + organic)' },
  { element: 'Sales promotion / Sales force', theme: 'Early Bird: free demo + 3 months free', keywords: ['demo', 'gratuit', 'testare', 'fără riscuri'], target: 15, where: 'Instagram DM, WhatsApp, visits' },
  { element: 'Product ad', theme: 'Automatic waitlist and SMS reminders', keywords: ['SMS automat', 'listă de așteptare', 'no-shows'], target: 4, where: 'Instagram, Facebook Ads' },
  { element: 'PR / Social proof', theme: 'Testimonials from the first salons', keywords: ['povești de succes', 'creștere profit', 'independență'], target: 4, where: 'Instagram Reels, TikTok' },
  { element: 'Educational marketing / Sales force', theme: 'The real cost of a per-chair marketplace', keywords: ['scalare barbershop', 'matematică afacere', 'reduceri costuri'], target: 6, where: 'LinkedIn, Instagram carousel' },
  { element: 'Sales promotion / Ad', theme: 'Premium Brand summer upgrade offer', keywords: ['automatizare', 'retenție', 'sistem fidelizare'], target: 4, where: 'Facebook Ads, email' },
  { element: 'PR / Local events', theme: 'Sponsoring a local barbering course', keywords: ['educație frizeri', 'parteneriat', 'VINIT'], target: 2, where: 'Classrooms, Instagram Live' },
  { element: 'Product ad', theme: 'UX focus: how easily clients book', keywords: ['booking rapid', 'interfață curată', 'clienți fericiți'], target: 5, where: 'TikTok Ads, Instagram Reels' },
  { element: 'Direct marketing (outreach)', theme: 'Larger salons (3+ chairs) outside Cluj', keywords: ['extindere', 'management echipă', 'rapoarte financiare'], target: 20, where: 'Cold email, LinkedIn' },
  { element: 'Sales promotion (referral)', theme: 'Bring a salon friend, get 3 months free', keywords: ['recomandare', 'comunitate frizeri', 'bonus'], target: 4, where: 'In-app notification, email' },
  { element: 'Social proof / Ad', theme: 'Year in review: hours saved by automations', keywords: ['timp salvat', 'eficiență', 'antreprenoriat'], target: 6, where: 'Instagram, Facebook Ads' },
  { element: 'PR / Brand ad', theme: 'Holidays: the gift your salon wants is independence', keywords: ['sărbători', 'ofertă final de an', 'digitalizare salon'], target: 8, where: 'All channels' },
];

export const PLANNED_APPEARANCES = MONTH_PLAN.reduce((sum, m) => sum + m.target, 0);

/** Communication mix with the target share from the business plan. */
export const MIX: readonly { value: string; label: string; target: number }[] = [
  { value: 'sales', label: 'Direct sales (B2B)', target: 40 },
  { value: 'social', label: 'Direct marketing & social', target: 30 },
  { value: 'ads', label: 'Paid ads', target: 20 },
  { value: 'pr', label: 'PR & partnerships', target: 10 },
];

export const FORMATS: readonly SelectOption[] = [
  { value: 'post', label: 'Post' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'ad', label: 'Paid ad' },
  { value: 'dm', label: 'DM' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'linkedin', label: 'LinkedIn post' },
  { value: 'visit', label: 'Visit' },
  { value: 'live', label: 'Live' },
  { value: 'event', label: 'Event' },
  { value: 'inapp', label: 'In-app' },
];

export const PLATFORMS: readonly string[] = [
  'Instagram',
  'Facebook',
  'TikTok',
  'LinkedIn',
  'WhatsApp',
  'Email',
  'In person',
  'In-app',
];

export const POST_STATUSES: readonly { value: string; label: string; tone: StatusTone }[] = [
  { value: 'planned', label: 'Planned', tone: 'neutral' },
  { value: 'draft', label: 'Draft', tone: 'info' },
  { value: 'ready', label: 'Ready', tone: 'teal' },
  { value: 'scheduled', label: 'Scheduled', tone: 'warn' },
  { value: 'published', label: 'Published', tone: 'ok' },
];

export const AD_BUDGET_MONTH = FINANCE.adsBudget;
export const AD_BUDGET_YEAR = FINANCE.adsBudget * 12;

export function labelOf(list: readonly { value: string; label: string }[], value: string): string {
  return list.find((x) => x.value === value)?.label ?? value;
}
