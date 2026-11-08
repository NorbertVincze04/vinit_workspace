import { Entity } from '../../../core/models';

export type PostStatus = 'planned' | 'draft' | 'ready' | 'scheduled' | 'published';

/** A channel of the communication mix with its target share of appearances. */
export interface Channel {
  /** Stable key stored on content items. */
  key: string;
  label: string;
  /** Target share of appearances, 0–100. */
  target: number;
  /** How the channel is used. */
  tactics: string;
}

/** One month of the 12-month campaign plan. */
export interface MonthPlan {
  /** Element of the communication mix. */
  element: string;
  theme: string;
  /** What the month should achieve. */
  goal: string;
  keywords: readonly string[];
  /** Planned appearances. */
  target: number;
  where: string;
  /** Ad budget for the month, RON. */
  budget: number;
}

/** A plan year of marketing (GET /marketing/years), with its strategy resolved. */
export interface MarketingYear {
  year: number;
  /** First and last calendar month, "YYYY-MM". */
  from: string;
  to: string;
  status: 'past' | 'current' | 'future';
  /** The year's strategy (the business plan's for Year 1 until it is first edited). */
  strategy: MarketingStrategy;
  /** Content items planned in the year (on the server). */
  posts: number;
}

/** A year's marketing strategy (Year 1 starts from the business plan). */
export interface MarketingStrategy {
  objectives: readonly string[];
  audience: { geographic: string; demographic: string; behavioral: string; psychographic: string };
  persona: { name: string; age: string; role: string; lifestyle: string; problem: string };
  positioning: {
    valueProposition: string;
    slogan: string;
    feature: string;
    advantage: string;
    benefit: string;
    pricing: string;
    distribution: string;
    competitors: string;
    launchOffer: string;
  };
  /** One-off launch budget, RON. */
  launchBudget: number;
  channels: readonly Channel[];
  /** Exactly 12, plan month 1 first. */
  months: readonly MonthPlan[];
}

/** One planned piece of content: a post, ad, DM batch, email, visit… */
export interface Post extends Entity {
  title: string;
  /** Plan year (1 = the first 12 months from the plan start). */
  year: number;
  /** Month 1–12 within the plan year. */
  month: number;
  /** Week 1–4, 0 = any. */
  week: number;
  /** Exact date "YYYY-MM-DD" (optional). */
  date: string;
  format: string;
  /** Channel key of the strategy's communication mix. */
  mix: string;
  platforms: string[];
  /** Number of appearances this item counts for. */
  count: number;
  /** Paid ad spend in RON. */
  budget: number;
  status: PostStatus;
  caption: string;
  visual: string;
  cta: string;
  keywords: string;
  hashtags: string;
  notes: string;
}

export interface PostFilters {
  q: string;
  /** PostStatus or 'all'. */
  status: string;
  /** Format key or 'all'. */
  format: string;
  /** Plan month 1–12, or 0 for all months. */
  month: number;
}

export interface MonthStats {
  items: number;
  appearances: number;
  published: number;
  adSpend: number;
}

export interface MixShare {
  value: string;
  label: string;
  target: number;
  share: number;
  /** Appearances planned on this channel. */
  appearances: number;
}

export interface PostGroup {
  month: number;
  posts: Post[];
  stats: MonthStats;
}
