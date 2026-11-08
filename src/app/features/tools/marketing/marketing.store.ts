import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService, apiError } from '../../../core/api/api.service';
import { apiCollection } from '../../../core/api/api-collection';
import { FieldMap, field } from '../../../core/api/api-fields';
import { FINANCE } from '../../../core/data/finance.data';
import { EntityData } from '../../../core/models';
import { ToastService } from '../../../core/services/toast.service';
import { percent } from '../../../core/utils/format';
import { matchesSearch } from '../../../core/utils/text';
import { ChipOption } from '../../../shared/ui';
import { DEFAULT_STRATEGY, POST_STATUSES } from './marketing.data';
import {
  Channel,
  MarketingStrategy,
  MarketingYear,
  MixShare,
  MonthPlan,
  MonthStats,
  Post,
  PostFilters,
  PostGroup,
  PostStatus,
} from './marketing.model';
import { t } from '../../../core/i18n/i18n';

const appearances = (p: Post): number => (Number(p.count) > 0 ? Number(p.count) : 1);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A saved strategy with the expected shape (anything else falls back to the business plan's). */
function isStrategy(v: unknown): v is MarketingStrategy {
  if (!isObject(v)) return false;
  return (
    Array.isArray(v['objectives']) &&
    isObject(v['audience']) &&
    isObject(v['persona']) &&
    isObject(v['positioning']) &&
    typeof v['launchBudget'] === 'number' &&
    Array.isArray(v['channels']) &&
    v['channels'].length > 0 &&
    Array.isArray(v['months']) &&
    v['months'].length === 12
  );
}

/** 'Paid ads' → 'paid-ads' (unique among the existing keys). */
function channelKey(label: string, taken: readonly string[]): string {
  const base =
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'channel';
  let key = base;
  for (let n = 2; taken.includes(key); n++) key = `${base}-${n}`;
  return key;
}

/**
 * A new year starts as a copy of the last one: same audience, positioning, channels and monthly
 * themes, without last year's monthly goals and launch budget (a one-off). Months without an ad
 * budget get the usual monthly one.
 */
export function nextYearStrategy(last: MarketingStrategy): MarketingStrategy {
  const budgets = last.months.map((m) => m.budget).filter((b) => b > 0);
  const usual = budgets.length ? budgets.sort((a, b) => budgets.filter((x) => x === b).length - budgets.filter((x) => x === a).length)[0] : FINANCE.adsBudget;
  return {
    ...last,
    launchBudget: 0,
    months: last.months.map((m) => ({ ...m, goal: '', budget: m.budget > 0 ? m.budget : usual })),
  };
}

interface YearRow extends Omit<MarketingYear, 'strategy'> {
  strategy: unknown;
}

/** How a post maps to the API (money in bani, empty date = null). */
const POST_FIELDS: FieldMap<Post> = {
  title: field.text(),
  year: field.int(),
  month: field.int(),
  week: field.int(),
  date: field.date(),
  format: field.text(),
  mix: field.text(),
  platforms: field.list(),
  count: field.int(),
  budget: field.money('budgetBani'),
  status: field.text(),
  caption: field.text(),
  visual: field.text(),
  cta: field.text(),
  keywords: field.text(),
  hashtags: field.text(),
  notes: field.text(),
};

/**
 * Marketing by plan year: each year's strategy (/api/v1/marketing/years) and content items
 * (/api/v1/marketing/posts, each with its year). Everything below "year" is the selected year's.
 */
@Injectable({ providedIn: 'root' })
export class MarketingStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly collection = apiCollection<Post>('/marketing/posts', POST_FIELDS, 'p');

  /** Every content item, all years. */
  readonly allPosts = this.collection.items;
  readonly filters = signal<PostFilters>({ q: '', status: 'all', format: 'all', month: 0 });

  // ---- years ----

  readonly years = signal<MarketingYear[]>([{ year: 1, from: '', to: '', status: 'current', strategy: DEFAULT_STRATEGY, posts: 0 }]);
  /** The plan year we are in (Year 1 before the plan starts). */
  readonly currentYear = signal(1);
  /** Year picked in the switcher; 0 = the current one. */
  private readonly picked = signal(0);

  readonly year = computed<MarketingYear>(() => {
    const ys = this.years();
    const n = this.picked() || this.currentYear();
    return ys.find((y) => y.year === n) ?? ys.find((y) => y.year === this.currentYear()) ?? ys[ys.length - 1];
  });
  readonly nextYear = computed(() => Math.max(...this.years().map((y) => y.year)) + 1);
  /** The selected year can be removed: the last one, not Year 1, not started and without content. */
  readonly canRemoveYear = computed(() => {
    const y = this.year();
    const isLast = y.year === Math.max(...this.years().map((x) => x.year));
    return isLast && y.year > 1 && y.status === 'future' && this.posts().length === 0;
  });

  // ---- the selected year ----

  readonly strategy = computed(() => this.year().strategy);
  /** Content items of the selected year. */
  readonly posts = computed(() => this.allPosts().filter((p) => (p.year || 1) === this.year().year));
  readonly months = computed(() => this.strategy().months);
  readonly channels = computed(() => this.strategy().channels);
  /** Planned appearances in the year (sum of the monthly targets). */
  readonly plannedAppearances = computed(() => this.months().reduce((sum, m) => sum + (Number(m.target) || 0), 0));
  /** Ad budget of the year (sum of the monthly budgets), RON. */
  readonly adBudgetYear = computed(() => this.months().reduce((sum, m) => sum + (Number(m.budget) || 0), 0));
  /** Sum of the channels' target shares (should be 100). */
  readonly mixTargetTotal = computed(() => this.channels().reduce((sum, c) => sum + (Number(c.target) || 0), 0));

  readonly totals = computed(() => {
    const s = this.statsOf(this.posts());
    return { ...s, planned: this.plannedAppearances() };
  });

  readonly mix = computed<MixShare[]>(() => {
    const total = this.totals().appearances;
    return this.channels().map((c) => {
      const count = this.posts()
        .filter((p) => p.mix === c.key)
        .reduce((sum, p) => sum + appearances(p), 0);
      return { value: c.key, label: c.label, target: c.target, share: percent(count, total), appearances: count };
    });
  });

  /** Stats per month of the year, index 0 = month 1. */
  readonly monthStats = computed<MonthStats[]>(() =>
    this.months().map((_, i) => this.statsOf(this.posts().filter((p) => p.month === i + 1))),
  );

  readonly statusChips = computed<ChipOption[]>(() => {
    const month = this.filters().month;
    const base = this.posts().filter((p) => !month || p.month === month);
    return [
      { value: 'all', label: 'All', count: base.length },
      ...POST_STATUSES.map((s) => ({ value: s.value, label: s.label, count: base.filter((p) => p.status === s.value).length })),
    ];
  });

  /** Filtered posts grouped by month, in plan order. */
  readonly groups = computed<PostGroup[]>(() => {
    const f = this.filters();
    const visible = this.posts()
      .filter((p) => !f.month || p.month === f.month)
      .filter((p) => f.status === 'all' || p.status === f.status)
      .filter((p) => f.format === 'all' || p.format === f.format)
      .filter((p) =>
        matchesSearch(f.q, p.title, p.caption, p.hashtags, p.keywords, p.visual, p.cta, p.notes, p.platforms.join(' ')),
      )
      .sort(
        (a, b) =>
          a.month - b.month ||
          (a.week || 9) - (b.week || 9) ||
          (a.date || '~').localeCompare(b.date || '~') ||
          a.createdAt.localeCompare(b.createdAt),
      );

    const groups: PostGroup[] = [];
    for (const post of visible) {
      let group = groups.find((g) => g.month === post.month);
      if (!group) {
        group = { month: post.month, posts: [], stats: this.monthStats()[post.month - 1] };
        groups.push(group);
      }
      group.posts.push(post);
    }
    return groups;
  });

  constructor() {
    void this.loadYears();
  }

  /** Plan month (counted from the plan start) of a month of the selected year: Year 2, month 1 → 13. */
  planMonth(month: number): number {
    return (this.year().year - 1) * 12 + month;
  }

  setFilters(patch: Partial<PostFilters>): void {
    this.filters.update((f) => ({ ...f, ...patch }));
  }

  // ---- content ----

  /** Adds an item to the selected year (unless it names its own). */
  add(data: Omit<EntityData<Post>, 'year'> & { year?: number }): Post {
    return this.collection.add({ ...data, year: data.year || this.year().year });
  }

  update(id: string, data: Partial<EntityData<Post>>): void {
    this.collection.update(id, data);
  }

  setStatus(id: string, status: PostStatus): void {
    this.collection.update(id, { status });
  }

  duplicate(post: Post): Post {
    const { id: _id, createdAt: _c, updatedAt: _u, ...data } = post;
    return this.collection.add({ ...data, title: `${post.title || 'Untitled'} (copy)`, status: 'planned' });
  }

  remove(id: string): void {
    this.collection.remove(id);
  }

  // ---- years ----

  selectYear(year: number): void {
    this.picked.set(year);
  }

  async loadYears(): Promise<void> {
    try {
      const res = await this.api.get<{ currentYear: number; items: YearRow[] }>('/marketing/years');
      let previous = DEFAULT_STRATEGY;
      const years = res.items.map((y) => {
        // A year never saved (Year 1 at first) shows the business plan's; a bad one, the year before's.
        const strategy = isStrategy(y.strategy) ? y.strategy : previous;
        previous = strategy;
        return { ...y, strategy };
      });
      if (years.length) this.years.set(years);
      this.currentYear.set(res.currentYear);
    } catch (error) {
      this.toast.show(t('Could not load the marketing plan: {error}', { error: apiError(error).message }), 6000);
    }
  }

  /** Adds the next year as a copy of the last one and shows it. */
  async addYear(): Promise<MarketingYear | null> {
    const last = this.years()[this.years().length - 1];
    try {
      const res = await this.api.write<{ item: YearRow }>('POST', '/marketing/years', { strategy: nextYearStrategy(last.strategy) });
      await this.loadYears();
      this.picked.set(res.item.year);
      this.toast.show(t('Year {n} added', { n: res.item.year }));
      return this.year();
    } catch (error) {
      this.toast.show(t('Not added: {error}', { error: apiError(error).message }), 6000);
      return null;
    }
  }

  async removeYear(year: number): Promise<void> {
    try {
      await this.api.write('DELETE', `/marketing/years/${year}`);
      this.picked.set(0);
      await this.loadYears();
      this.toast.show(t('Year {n} removed', { n: year }));
    } catch (error) {
      this.toast.show(t('Not removed: {error}', { error: apiError(error).message }), 6000);
    }
  }

  // ---- strategy of the selected year ----

  updateStrategy(patch: Partial<MarketingStrategy>): void {
    this.saveStrategy((s) => ({ ...s, ...patch }));
  }

  updateMonth(month: number, patch: Partial<MonthPlan>): void {
    this.saveStrategy((s) => ({ ...s, months: s.months.map((m, i) => (i === month - 1 ? { ...m, ...patch } : m)) }));
  }

  /** Adds a channel (key null) or changes one. */
  saveChannel(key: string | null, data: Omit<Channel, 'key'>): void {
    this.saveStrategy((s) => {
      if (key) return { ...s, channels: s.channels.map((c) => (c.key === key ? { ...c, ...data } : c)) };
      const newKey = channelKey(data.label, s.channels.map((c) => c.key));
      return { ...s, channels: [...s.channels, { key: newKey, ...data }] };
    });
  }

  removeChannel(key: string): void {
    this.saveStrategy((s) => ({ ...s, channels: s.channels.filter((c) => c.key !== key) }));
  }

  /** Content items of the selected year planned on a channel. */
  postsOnChannel(key: string): number {
    return this.posts().filter((p) => p.mix === key).length;
  }

  /** Back to the business plan (Year 1), or to a copy of the year before. */
  resetStrategy(): void {
    const y = this.year().year;
    const before = this.years().find((x) => x.year === y - 1);
    this.saveStrategy(() => (before ? nextYearStrategy(before.strategy) : DEFAULT_STRATEGY));
  }

  /** Shows the change at once and saves it; on failure, reloads what the server has. */
  private saveStrategy(change: (s: MarketingStrategy) => MarketingStrategy): void {
    const year = this.year().year;
    const next = change(this.year().strategy);
    this.years.update((ys) => ys.map((y) => (y.year === year ? { ...y, strategy: next } : y)));
    this.api.write('PUT', `/marketing/years/${year}`, { strategy: next }).catch((error: unknown) => {
      this.toast.show(t('Not saved: {error}', { error: apiError(error).message }), 6000);
      void this.loadYears();
    });
  }

  // ---- backup ----

  snapshot(): { posts: readonly Post[]; years: { year: number; strategy: MarketingStrategy }[] } {
    return { posts: this.allPosts(), years: this.years().map((y) => ({ year: y.year, strategy: y.strategy })) };
  }

  /** Restores a backup: content, and each year's strategy (adding missing years). Older backups had one strategy. */
  importState(data: unknown): boolean {
    const backup = data as { posts?: unknown; strategy?: unknown; years?: unknown } | null;
    if (!Array.isArray(backup?.posts)) return false;
    const years: { year: number; strategy: MarketingStrategy }[] = Array.isArray(backup.years)
      ? (backup.years as { year?: unknown; strategy?: unknown }[])
          .filter((y): y is { year: number; strategy: MarketingStrategy } => typeof y.year === 'number' && isStrategy(y.strategy))
          .sort((a, b) => a.year - b.year)
      : isStrategy(backup.strategy)
        ? [{ year: 1, strategy: backup.strategy }]
        : [];
    void (async () => {
      try {
        for (const y of years) {
          const exists = this.years().some((x) => x.year === y.year);
          if (exists) await this.api.write('PUT', `/marketing/years/${y.year}`, { strategy: y.strategy });
          else if (y.year === this.nextYear()) await this.api.write('POST', '/marketing/years', { strategy: y.strategy });
          await this.loadYears();
        }
        await this.collection.replaceAll(backup.posts as Post[]);
      } catch (error) {
        this.toast.show(t('Backup not fully restored: {error}', { error: apiError(error).message }), 6000);
      }
    })();
    return true;
  }

  private statsOf(list: readonly Post[]): MonthStats {
    let total = 0;
    let published = 0;
    let adSpend = 0;
    for (const p of list) {
      total += appearances(p);
      if (p.status === 'published') published += appearances(p);
      adSpend += Number(p.budget) || 0;
    }
    return { items: list.length, appearances: total, published, adSpend };
  }
}
