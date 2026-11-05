import { Entity } from '../../../core/models';

export type PostStatus = 'planned' | 'draft' | 'ready' | 'scheduled' | 'published';

/** One planned piece of content: a post, ad, DM batch, email, visit… */
export interface Post extends Entity {
  title: string;
  /** Plan month 1–12. */
  month: number;
  /** Week 1–4, 0 = any. */
  week: number;
  /** Exact date "YYYY-MM-DD" (optional). */
  date: string;
  format: string;
  /** Communication-mix element key (see MIX). */
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
}

export interface PostGroup {
  month: number;
  posts: Post[];
  stats: MonthStats;
}
