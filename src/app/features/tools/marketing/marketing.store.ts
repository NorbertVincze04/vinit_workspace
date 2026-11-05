import { Injectable, computed, signal } from '@angular/core';
import { EntityData } from '../../../core/models';
import { percent } from '../../../core/utils/format';
import { persistedCollection } from '../../../core/utils/persisted-collection';
import { matchesSearch } from '../../../core/utils/text';
import { ChipOption } from '../../../shared/ui';
import { MIX, MONTH_PLAN, PLANNED_APPEARANCES, POST_STATUSES } from './marketing.data';
import { MixShare, MonthStats, Post, PostFilters, PostGroup, PostStatus } from './marketing.model';

const appearances = (p: Post): number => (Number(p.count) > 0 ? Number(p.count) : 1);

/** Marketing plan state. Saved in localStorage under "vinit.marketing.v1". */
@Injectable({ providedIn: 'root' })
export class MarketingStore {
  private readonly collection = persistedCollection<Post>('marketing.v1', 'p');

  readonly posts = this.collection.items;
  readonly filters = signal<PostFilters>({ q: '', status: 'all', format: 'all', month: 0 });

  readonly totals = computed(() => {
    const s = this.statsOf(this.posts());
    return { ...s, planned: PLANNED_APPEARANCES };
  });

  readonly mix = computed<MixShare[]>(() => {
    const total = this.totals().appearances;
    return MIX.map((m) => {
      const count = this.posts()
        .filter((p) => p.mix === m.value)
        .reduce((sum, p) => sum + appearances(p), 0);
      return { ...m, share: percent(count, total) };
    });
  });

  /** Stats per plan month, index 0 = month 1. */
  readonly monthStats = computed<MonthStats[]>(() =>
    MONTH_PLAN.map((_, i) => this.statsOf(this.posts().filter((p) => p.month === i + 1))),
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

  setFilters(patch: Partial<PostFilters>): void {
    this.filters.update((f) => ({ ...f, ...patch }));
  }

  add(data: EntityData<Post>): Post {
    return this.collection.add(data);
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

  snapshot(): { posts: readonly Post[] } {
    return { posts: this.posts() };
  }

  importState(data: unknown): boolean {
    const list = (data as { posts?: unknown } | null)?.posts;
    if (!Array.isArray(list)) return false;
    this.collection.replaceAll(list as Post[]);
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
