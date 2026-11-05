import type { IconName } from '../../shared/ui/icon/icons';

/** Shapes for the business-plan content shown on the overview page (see core/data/business.data.ts). */

export interface Company {
  name: string;
  legalName: string;
  slogan: string;
  sloganRo: string;
  /** One neutral paragraph describing the business. */
  summary: string;
  city: string;
  workModel: string;
  founder: string;
  website: { label: string; url: string };
  futureDomain: string;
}

/** A labelled piece of information, e.g. { label: 'Headquarters', value: 'Cluj-Napoca' }. */
export interface Fact {
  label: string;
  value: string;
}

export interface KeyFigure {
  label: string;
  value: string;
  hint?: string;
}

export interface ValuePoint {
  icon: IconName;
  title: string;
  text: string;
}

export interface PricingPackage {
  id: string;
  name: string;
  price: string;
  includes: readonly string[];
  sessions: string;
}

export interface GoalItem {
  tag: string;
  title: string;
  text: string;
}

export interface GoalGroup {
  label: string;
  goals: readonly GoalItem[];
}

export interface ComparisonTable {
  columns: readonly string[];
  rows: readonly { trait: string; values: readonly boolean[] }[];
}

export interface Persona {
  name: string;
  age: number;
  role: string;
  lifestyle: string;
  problem: string;
}

export interface TeamRole {
  title: string;
  type: string;
  duties: readonly string[];
  reward: string;
}

export interface Risk {
  title: string;
  problem: string;
  response: string;
}

export interface CostItem {
  item: string;
  amount: number;
}
