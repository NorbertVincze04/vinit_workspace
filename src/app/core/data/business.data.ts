import {
  Company,
  ComparisonTable,
  CostItem,
  Fact,
  GoalGroup,
  KeyFigure,
  Persona,
  PricingPackage,
  Risk,
  TableData,
  TeamRole,
  ValuePoint,
} from '../models';
import { formatNumber } from '../utils/format';
import { BREAK_EVEN_SALONS, FINANCE, YEAR1_MRR } from './finance.data';

/**
 * Business-plan reference content for the internal overview page,
 * summarised from "Business Plan.docx". Edit text here — the components only render it.
 */

// ---------------------------------------------------------------- Company

export const COMPANY: Company = {
  name: 'VINIT',
  legalName: 'VINIT SaaS Solutions SRL',
  slogan: 'Your brand. Your app. No limits.',
  sloganRo: 'Brandul tău. Aplicația ta. Fără limite.',
  summary:
    'VINIT builds a white-label booking and management platform for barbershops. Each salon gets its own web app ' +
    '(own domain, logo and colours) for a fixed monthly subscription, with no fee per staff member and no competing ' +
    'salons shown to its clients.',
  city: 'Cluj-Napoca',
  workModel: 'Remote',
  founder: 'Vincze Norbert-Istvan',
  website: { label: 'vinit.vincze-norbert.com', url: 'https://vinit.vincze-norbert.com/' },
  futureDomain: 'vinit.ro',
};

export const COMPANY_FACTS: readonly Fact[] = [
  { label: 'Legal entity', value: `${COMPANY.legalName} · share capital ${formatNumber(FINANCE.shareCapital)} RON` },
  { label: 'Headquarters', value: 'Cluj-Napoca, Cluj county · remote work model, no rent' },
  { label: 'Main activity', value: 'CAEN 6201 · Custom software development' },
  { label: 'Secondary', value: 'CAEN 6202 · IT consulting; CAEN 6311 · Data processing & web hosting' },
  { label: 'Business model', value: 'B2B white-label SaaS, fixed monthly subscription per salon' },
  { label: 'Customers', value: 'Independent barbershops in Romanian cities (CAEN 9602)' },
  { label: 'Administrator', value: COMPANY.founder },
  { label: 'Team (Year 1)', value: '2 people: founder / administrator and marketing & B2B sales' },
  { label: 'Website', value: `${COMPANY.website.label} (${COMPANY.futureDomain} after launch)` },
  { label: 'Slogan', value: `“${COMPANY.sloganRo}”` },
];

export const TEAM: readonly TeamRole[] = [
  {
    title: 'Founder / Administrator',
    type: 'Full-time',
    duties: [
      'Company strategy, finances and planning',
      'Software development and cloud infrastructure',
      'Technical onboarding of new salons, monitoring and support',
    ],
    reward: 'Profit reinvested in the early stages (annual dividends later).',
  },
  {
    title: 'Marketing & B2B Sales',
    type: 'Full-time / part-time',
    duties: [
      'Lead generation, outreach and live product demos',
      'Social media presence and campaigns (e.g. Early Bird)',
      'Commercial relationship with existing salons',
    ],
    reward: 'Base salary plus a bonus for every salon signed and activated.',
  },
];

export const TECH_STACK: readonly string[] = [
  'Angular',
  'Express.js',
  'PostgreSQL',
  'Multi-tenant',
  'PWA',
  'Vercel',
  'Railway',
  'Twilio',
];

// ---------------------------------------------------------------- Product & pricing

export const VALUE_POINTS: readonly ValuePoint[] = [
  { icon: 'shield', title: 'Own brand', text: 'White-label web app on the salon’s own domain, with its logo and colours.' },
  { icon: 'tag', title: 'Fixed price', text: 'Flat monthly subscription; adding barbers costs nothing extra.' },
  { icon: 'eye', title: 'No competitors shown', text: 'Clients only see the salon they book with, unlike on marketplaces.' },
  { icon: 'message', title: 'Automations', text: 'SMS/WhatsApp reminders and an automatic waitlist (Premium) reduce no-shows.' },
];

export const POSITIONING =
  'Competitors (Mero, Stailer, Booksy, Vagaro, Fresha) are marketplaces: they charge per employee or chair and list ' +
  'salons next to local competitors. VINIT is pure SaaS infrastructure under the salon’s own brand. Pricing strategy: ' +
  'market penetration with a fixed, predictable subscription.';

export const PACKAGES: readonly PricingPackage[] = [
  {
    id: 'standard',
    name: 'Standard Barbershop',
    price: `${FINANCE.standardPrice} RON / month`,
    includes: ['Personalised web app (PWA)', 'Client booking', 'Staff calendar', 'Basic owner reports'],
    sessions: '2 × 30 min',
  },
  {
    id: 'premium',
    name: 'Premium Brand',
    price: `${FINANCE.premiumPrice} RON / month`,
    includes: ['Everything in Standard', 'SMS/WhatsApp reminders (Twilio)', 'Automatic waitlist', 'Digital punch-card', 'Private client notes'],
    sessions: '2 × 30 min',
  },
  {
    id: 'custom',
    name: 'Custom',
    price: `from ${formatNumber(FINANCE.customFrom)} RON, or min. 4-month subscription`,
    includes: ['Fully bespoke website', 'Presentation-only sites possible'],
    sessions: '3 × 30 min',
  },
];

export const PACKAGES_TABLE: TableData = {
  headers: ['Package', 'Price', 'Includes', 'Sessions'],
  rows: PACKAGES.map((p) => [p.name, p.price, p.includes.join(', '), p.sessions]),
};

export const OFFER_RULES: readonly string[] = [
  `Changes after prototype approval (structure, major design, new features) are billed at ${FINANCE.extraWorkHourly} RON / hour.`,
  `Early Bird Beta: the first ${FINANCE.year1Salons} salons get 3 months free.`,
  'Each new salon is configured and live in under 48 hours after signing.',
  'Distribution is direct and online: landing page plus direct B2B sales (phone, meetings).',
];

// ---------------------------------------------------------------- Year 1 plan

export const GOAL_GROUPS: readonly GoalGroup[] = [
  {
    label: 'Year 1',
    goals: [
      {
        tag: 'Operational',
        title: 'MVP + 5 beta salons',
        text: 'MVP launched and free testing finished with feedback from the first 5 partner salons in Cluj by the end of month 3.',
      },
      {
        tag: 'Commercial',
        title: `${FINANCE.year1Salons} paying salons`,
        text: `${FINANCE.year1Salons} paying barbershops (Standard + Premium), at least ${formatNumber(YEAR1_MRR)} RON MRR, all monthly costs covered by month 12.`,
      },
      {
        tag: 'Retention',
        title: '≥ 70% retention, < 48 h setup',
        text: 'Customer retention of at least 70%, backed by onboarding that has every new salon live in under 48 hours.',
      },
    ],
  },
  {
    label: 'Years 3–5',
    goals: [
      {
        tag: 'Market share',
        title: '~500 salons, 75.000 RON MRR',
        text: '15% of independent urban barbershops in Romania and more than 75.000 RON MRR by the end of year 3.',
      },
      {
        tag: 'Expansion',
        title: '10 cities, team of 4',
        text: 'At least 10 big cities and a team of 4 (management, development, B2B sales, support) by the end of year 4.',
      },
      {
        tag: 'Product',
        title: '3 add-ons, +20% ARPU',
        text: 'Online card payments, stock management and advanced marketing reports, raising revenue per salon by 20% by year 5.',
      },
    ],
  },
];

export const QUARTER_PLAN: TableData = {
  headers: ['Period', 'Main activity', 'Deadline', 'Owner', 'Budget'],
  rows: [
    ['Q1', 'Multi-tenant cloud architecture and UI/UX', 'Month 3', 'Founder', `${formatNumber(FINANCE.initialInvestment)} RON (initial)`],
    ['Q2', `Beta launch; ${FINANCE.betaSalons} salons onboarded free for testing`, 'Month 6', 'Founder', `${formatNumber(FINANCE.monthlyOperational)} RON / month`],
    ['Q3', 'Paid packages launched; social campaigns; cold calling', 'Month 9', 'Full team', `${formatNumber(FINANCE.monthlyCosts)} RON / month`],
    ['Q4', 'Platform optimisation from feedback; new customers', 'Month 12', 'Full team', `${formatNumber(FINANCE.monthlyCosts)} RON / month + revenue`],
  ],
};

export const KEY_DEADLINES: readonly Fact[] = [
  { label: 'MVP launch', value: 'End of month 3' },
  { label: 'Plan B checkpoint', value: `End of month 9 — under ${FINANCE.month9Checkpoint} paying salons triggers Plan B` },
  {
    label: 'Break-even',
    value: `Month 12 — ${BREAK_EVEN_SALONS} Standard salons (${formatNumber(BREAK_EVEN_SALONS * FINANCE.standardPrice)} RON / month)`,
  },
];

// ---------------------------------------------------------------- Finances

export const FINANCE_FIGURES: readonly KeyFigure[] = [
  { label: 'Initial investment', value: `${formatNumber(FINANCE.initialInvestment)} RON`, hint: '≈ 4.650 EUR' },
  {
    label: 'Monthly costs',
    value: `${formatNumber(FINANCE.monthlyCosts)} RON`,
    hint: `${formatNumber(FINANCE.monthlyCosts * 12)} RON per year`,
  },
  { label: 'Break-even', value: `${BREAK_EVEN_SALONS} salons`, hint: 'on the Standard plan' },
  {
    label: 'Profit at 50 salons',
    value: `${formatNumber(YEAR1_MRR - FINANCE.monthlyCosts)} RON`,
    hint: 'per month, reinvested',
  },
  {
    label: 'Funding target',
    value: `${formatNumber(FINANCE.fundingTargetEur)} EUR`,
    hint: `≈ ${formatNumber(FINANCE.fundingTargetRon)} RON`,
  },
];

export const INVESTMENT_ITEMS: readonly CostItem[] = [
  { item: 'Share capital', amount: 1_000 },
  { item: 'Company registration (ONRC, e-signature, bank)', amount: 400 },
  { item: 'Legal compliance (GDPR, contracts)', amount: 1_000 },
  { item: 'Domain (yearly)', amount: 100 },
  { item: 'Launch marketing', amount: 2_000 },
  { item: 'Laptop', amount: 6_600 },
  { item: 'Peripherals', amount: 600 },
  { item: 'Monitor', amount: 1_750 },
  { item: 'Ergonomic desk', amount: 1_200 },
  { item: 'Ergonomic chair', amount: 800 },
  { item: 'Storage', amount: 375 },
  { item: 'Phone', amount: 3_500 },
  { item: 'Router', amount: 260 },
  { item: 'Contingency reserve', amount: 5_000 },
];

export const INVESTMENT_TABLE: TableData = {
  headers: ['Item', 'RON'],
  numeric: [1],
  rows: INVESTMENT_ITEMS.map((c) => [c.item, formatNumber(c.amount)]),
  footer: ['Total', formatNumber(INVESTMENT_ITEMS.reduce((sum, c) => sum + c.amount, 0))],
};

export const MONTHLY_COSTS: readonly Fact[] = [
  { label: 'Operating costs', value: `${formatNumber(FINANCE.monthlyOperational)} RON` },
  { label: 'Salaries', value: `${formatNumber(FINANCE.monthlySalaries)} RON` },
  { label: 'Total', value: `${formatNumber(FINANCE.monthlyCosts)} RON / month` },
  { label: 'Ads budget', value: `${FINANCE.adsBudget} RON / month (part of operating costs)` },
  { label: 'SMS (Twilio)', value: '300 RON / month ≈ 1.500 reminders at 0,20 RON' },
  { label: 'Rent', value: '0 RON (free-use agreement)' },
];

export const FUNDING_SOURCES: readonly string[] = [
  'Start-Up Nation 2026 — non-refundable government grant (main option)',
  'Innovation Labs accelerator — MVP validation, pitching, investor access (plan B)',
];

// ---------------------------------------------------------------- Market & competition

export const MARKET_FIGURES: readonly KeyFigure[] = [
  { label: 'Global salon software', value: '$1B+', hint: '≈ 14% yearly growth' },
  { label: 'Target barbershops', value: `${FINANCE.marketSize}`, hint: 'independent, big cities' },
  { label: 'National market', value: `${formatNumber(FINANCE.nationalMarket)}+`, hint: 'salons in Romania' },
  { label: 'Year 1 share', value: '10%', hint: `${FINANCE.year1Salons} salons` },
];

export const SEGMENTS: readonly Fact[] = [
  { label: 'Geographic', value: 'Urban Romania first: Cluj-Napoca, București, Timișoara, Brașov, Iași.' },
  { label: 'Demographic', value: 'Owners aged 20–35 running 2 to 10+ chair salons (SRL/PFA, CAEN 9602).' },
  { label: 'Behavioural', value: 'Phone-first, fast decisions, driven by recommendations, UX and cost.' },
  { label: 'Psychographic', value: 'Care about image, design and branding; active on Instagram and TikTok.' },
];

export const PERSONA: Persona = {
  name: 'Andrei Popescu',
  age: 28,
  role: 'Founder and lead barber, 4-chair barbershop in Cluj-Napoca',
  lifestyle: 'Ambitious, works 10-hour days, posts his work on social media.',
  problem:
    'Pays too much to his booking platform, feels he works to pay commissions, and dislikes that clients see offers from nearby salons when booking with him.',
};

export const COMPARISON: ComparisonTable = {
  columns: ['VINIT', 'Mero', 'Stailer', 'Booksy'],
  rows: [
    { trait: 'White-label app (own brand)', values: [true, false, false, false] },
    { trait: 'Fixed price, no fee per extra barber', values: [true, false, false, false] },
    { trait: 'Does not show competing salons', values: [true, false, false, false] },
    { trait: 'SMS reminders & waitlist', values: [true, true, true, true] },
  ],
};

export const COMPETITION_NOTES: readonly string[] = [
  'Mero dominates the local market and is well funded; Stailer invests heavily in marketing.',
  'Competitors focus on B2C acquisition of end clients; VINIT focuses on B2B.',
  'Main entry barrier: convincing salons to migrate from the system they already use.',
];

// ---------------------------------------------------------------- Risks

export const RISKS: readonly Risk[] = [
  {
    title: 'Slow adoption',
    problem: 'Salon owners hesitate to migrate their client data, fearing technical complexity.',
    response: 'Free assisted onboarding: VINIT configures everything, and the interface stays simple.',
  },
  {
    title: 'Downtime or data loss',
    problem: 'Outages at peak times or lost bookings would destroy customer trust.',
    response: 'Professional, redundant cloud hosting (Vercel) and automatic daily PostgreSQL backups.',
  },
  {
    title: 'Cash-flow shortfall',
    problem: 'Marketing spend could exhaust funds before break-even.',
    response: 'Minimal fixed costs; direct B2B sales first (time, not money); aggressive ads only once cash flow is positive.',
  },
];

export const PLAN_B =
  `If the fixed-fee model for small salons does not reach the expected volume (under ${FINANCE.month9Checkpoint} paying ` +
  `salons at the end of month 9), pivot to large salons and beauty chains: an Enterprise multi-location offer at ` +
  `${formatNumber(FINANCE.customFrom)}+ RON / month sold to 5–10 chains.`;

// ---------------------------------------------------------------- Sustainability

export const SUSTAINABILITY: readonly ValuePoint[] = [
  { icon: 'file', title: 'Paperless salons', text: 'Cloud calendar and digital punch-cards replace paper agendas and loyalty cards.' },
  { icon: 'cloud', title: 'Multi-tenant cloud', text: 'One shared platform serves every salon — 50 sites on roughly the resources of one.' },
  { icon: 'leaf', title: 'Serverless hosting', text: 'Vercel and Railway scale down in low-traffic periods instead of running at full power.' },
  { icon: 'cube', title: '3D-printed items', text: 'QR stands, phone holders and keychains printed from PLA or recycled rPET.' },
  { icon: 'laptop', title: 'Remote team', text: 'No commute and no office to heat, light and cool.' },
];
