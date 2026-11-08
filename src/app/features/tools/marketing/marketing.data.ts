import { FINANCE } from '../../../core/data/finance.data';
import { SelectOption, StatusTone } from '../../../shared/ui';
import { MarketingStrategy, MonthPlan } from './marketing.model';

/**
 * Marketing plan reference data (business plan § 2.5 and Annex 3).
 * Keywords stay in Romanian because they are used as-is in the content.
 */

/** Default ad budget per month: months 1–3 run on the launch budget, then the plan's 500 RON a month. */
const months: MonthPlan[] = [
  { element: 'Launch ad / Direct marketing', theme: 'Education: Marketplace vs. own brand', keywords: ['comisioane', 'brand propriu', 'aplicație frizerie'], goal: '', target: 8, where: 'Instagram (Ads + organic)', budget: 0 },
  { element: 'Sales promotion / Sales force', theme: 'Early Bird: free demo + 3 months free', keywords: ['demo', 'gratuit', 'testare', 'fără riscuri'], goal: '', target: 15, where: 'Instagram DM, WhatsApp, visits', budget: 0 },
  { element: 'Product ad', theme: 'Automatic waitlist and SMS reminders', keywords: ['SMS automat', 'listă de așteptare', 'no-shows'], goal: 'MVP live by the end of the month.', target: 4, where: 'Instagram, Facebook Ads', budget: 0 },
  { element: 'PR / Social proof', theme: 'Testimonials from the first salons', keywords: ['povești de succes', 'creștere profit', 'independență'], goal: '', target: 4, where: 'Instagram Reels, TikTok', budget: FINANCE.adsBudget },
  { element: 'Educational marketing / Sales force', theme: 'The real cost of a per-chair marketplace', keywords: ['scalare barbershop', 'matematică afacere', 'reduceri costuri'], goal: '', target: 6, where: 'LinkedIn, Instagram carousel', budget: FINANCE.adsBudget },
  { element: 'Sales promotion / Ad', theme: 'Premium Brand summer upgrade offer', keywords: ['automatizare', 'retenție', 'sistem fidelizare'], goal: '5 beta salons using the app and giving feedback.', target: 4, where: 'Facebook Ads, email', budget: FINANCE.adsBudget },
  { element: 'PR / Local events', theme: 'Sponsoring a local barbering course', keywords: ['educație frizeri', 'parteneriat', 'VINIT'], goal: '', target: 2, where: 'Classrooms, Instagram Live', budget: FINANCE.adsBudget },
  { element: 'Product ad', theme: 'UX focus: how easily clients book', keywords: ['booking rapid', 'interfață curată', 'clienți fericiți'], goal: '', target: 5, where: 'TikTok Ads, Instagram Reels', budget: FINANCE.adsBudget },
  { element: 'Direct marketing (outreach)', theme: 'Larger salons (3+ chairs) outside Cluj', keywords: ['extindere', 'management echipă', 'rapoarte financiare'], goal: 'Paid plans launched; 20 paying salons.', target: 20, where: 'Cold email, LinkedIn', budget: FINANCE.adsBudget },
  { element: 'Sales promotion (referral)', theme: 'Bring a salon friend, get 3 months free', keywords: ['recomandare', 'comunitate frizeri', 'bonus'], goal: '', target: 4, where: 'In-app notification, email', budget: FINANCE.adsBudget },
  { element: 'Social proof / Ad', theme: 'Year in review: hours saved by automations', keywords: ['timp salvat', 'eficiență', 'antreprenoriat'], goal: '', target: 6, where: 'Instagram, Facebook Ads', budget: FINANCE.adsBudget },
  { element: 'PR / Brand ad', theme: 'Holidays: the gift your salon wants is independence', keywords: ['sărbători', 'ofertă final de an', 'digitalizare salon'], goal: '50 paying salons and 7.500 RON MRR.', target: 8, where: 'All channels', budget: FINANCE.adsBudget },
];

/**
 * The marketing strategy of the business plan (§ 2 and Annex 3). It is the starting point: the
 * team edits it in the Strategy tab and it is saved as the "marketing.strategy" setting.
 */
export const DEFAULT_STRATEGY: MarketingStrategy = {
  objectives: [
    'Educate the market: show salon owners the hidden costs and the loss of brand identity on marketplace platforms.',
    'Acquisition: generate qualified leads and book demo sessions, to reach 50 active salons in Year 1.',
  ],
  audience: {
    geographic: 'Urban Romania, starting with Cluj-Napoca, then Bucharest, Timișoara and Iași. Later national and European.',
    demographic: 'Owners and managers aged 20–35 with medium to high digital skills, running small or medium salons (2 chairs up to 10+ staff); SRL or PFA under CAEN 9602.',
    behavioral: 'Efficiency- and growth-minded: run the business from their phone, decide fast, value a smooth interface and cut unnecessary costs such as marketplace fees.',
    psychographic: 'Passionate about image, design and branding; the salon is an extension of their personality. Active on Instagram and TikTok, they want a premium experience for their clients.',
  },
  persona: {
    name: 'Andrei Popescu',
    age: '28',
    role: 'Founder and lead barber of a 4-chair barbershop in Cluj-Napoca',
    lifestyle: 'Ambitious, works 10 hours a day, always on social media posting his work (fades, styling).',
    problem: 'Pays too much to his booking platform and feels he works to pay commissions; dislikes that his clients see nearby salons when they book with him. Wants his own app without paying a lot upfront.',
  },
  positioning: {
    valueProposition: 'Each salon gets its own white-label web app (domain, logo, colours) for a fixed monthly fee that doesn’t charge extra per barber, with no competitors shown to its clients.',
    slogan: 'Brandul tău. Aplicația ta. Fără limite.',
    feature: 'B2B white-label platform with a fixed monthly subscription.',
    advantage: 'The barbershop gets a web app with its own domain, logo and colours, isn’t listed next to competitors, and pays nothing extra when it hires barbers.',
    benefit: 'The owner keeps their clients, strengthens their brand locally, has fully predictable costs and maximises profit.',
    pricing: 'Market penetration: Standard 150 RON/month, Premium 200 RON/month, Custom from 1.000 RON. Fixed and predictable, below the commissions a medium salon pays marketplaces.',
    distribution: 'Direct, no intermediaries: landing page and direct B2B sales (phone, meetings). National, Cluj-Napoca first. Each salon is set up within 48 hours.',
    competitors: 'Mero, Stailer, Booksy, Vagaro, Fresha: marketplaces that charge per chair or per new client and list salons next to each other.',
    launchOffer: 'Early Bird Beta: the first 50 salons get 3 months of full use for free.',
  },
  launchBudget: 2_000,
  channels: [
    { key: 'sales', label: 'Direct sales (B2B)', target: 40, tactics: 'Instagram DMs, email and short visits to salons in Cluj-Napoca, offering free demos of the platform.' },
    { key: 'social', label: 'Direct marketing & social', target: 30, tactics: 'Instagram and TikTok content about barbers’ problems, e.g. how much commission they lose each month.' },
    { key: 'ads', label: 'Paid ads', target: 20, tactics: 'Facebook and Instagram Ads targeted strictly at barbershop page admins.' },
    { key: 'pr', label: 'PR & partnerships', target: 10, tactics: 'Barbering influencers and local equipment or supplies distributors.' },
  ],
  months,
};

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

export function labelOf(list: readonly { value: string; label: string }[], value: string): string {
  return list.find((x) => x.value === value)?.label ?? value;
}
