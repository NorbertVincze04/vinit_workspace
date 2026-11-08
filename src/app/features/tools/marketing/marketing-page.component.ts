import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlanCalendarService } from '../../../core/services/plan-calendar.service';
import { ToastService } from '../../../core/services/toast.service';
import { persistedSignal } from '../../../core/utils/persisted-signal';
import { BackupMenuComponent, PlanStartFieldComponent } from '../../../shared/components';
import {
  ButtonComponent,
  ChipGroupComponent,
  ConfirmDialogComponent,
  EmptyStateComponent,
  FormDialogComponent,
  FormValues,
  IconComponent,
  LedgerComponent,
  PageHeaderComponent,
  SelectFieldComponent,
  SelectOption,
  TabsComponent,
  TextFieldComponent,
} from '../../../shared/ui';
import { MarketingOverviewComponent } from './components/marketing-overview/marketing-overview.component';
import { MonthBriefComponent } from './components/month-brief/month-brief.component';
import { MonthRailComponent } from './components/month-rail/month-rail.component';
import { PostItemComponent } from './components/post-item/post-item.component';
import { MarketingStrategyComponent } from './components/strategy/marketing-strategy.component';
import { FORMATS } from './marketing.data';
import { postFields, postFromForm, postToForm } from './marketing.fields';
import { Post, PostStatus } from './marketing.model';
import { MarketingStore } from './marketing.store';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';
import { TcPipe } from '../../../core/i18n/tc.pipe';

type MarketingTab = 'strategy' | 'content';

/** Marketing tool: the strategy (audience, positioning, channels, budget, 12-month plan) and the content calendar. */
@Component({
  selector: 'app-marketing-page',
  standalone: true,
  imports: [TcPipe, TPipe, 
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    TextFieldComponent,
    SelectFieldComponent,
    ChipGroupComponent,
    LedgerComponent,
    EmptyStateComponent,
    FormDialogComponent,
    ConfirmDialogComponent,
    BackupMenuComponent,
    PlanStartFieldComponent,
    MarketingOverviewComponent,
    MonthRailComponent,
    MonthBriefComponent,
    PostItemComponent,
    TabsComponent,
    MarketingStrategyComponent,
  ],
  templateUrl: './marketing-page.component.html',
  styleUrl: './marketing-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingPageComponent {
  protected readonly store = inject(MarketingStore);
  protected readonly plan = inject(PlanCalendarService);
  private readonly toast = inject(ToastService);

  protected readonly tabs = [
    { value: 'strategy', label: 'Strategy' },
    { value: 'content', label: 'Content calendar' },
  ];
  protected readonly tab = persistedSignal<MarketingTab>('marketing.tab', () => 'strategy', {
    validate: (v): v is MarketingTab => v === 'strategy' || v === 'content',
  });
  protected readonly formatOptions: readonly SelectOption[] = [{ value: 'all', label: 'All formats' }, ...FORMATS];
  /** "Dec 2026" for month n of the selected year. */
  protected readonly monthLabel = (n: number): string => this.plan.monthLabel(this.store.planMonth(n));

  protected readonly yearOptions = computed(() =>
    this.store.years().map((y) => ({ value: String(y.year), label: t('Year {n}', { n: y.year }) + (y.status === 'current' ? ' · ' + t('now') : '') })),
  );
  protected readonly yearValue = computed(() => String(this.store.year().year));
  /** "Dec 2026 – Nov 2027 · This year". */
  protected readonly range = computed(() => {
    const y = this.store.year();
    const status = t(y.status === 'past' ? 'Ended' : y.status === 'current' ? 'This year' : 'Not started');
    return `${this.monthLabel(1)} – ${this.monthLabel(12)} · ${status}`;
  });
  protected readonly removingYear = signal<number | null>(null);

  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected readonly form = signal<{ post: Post | null; values: FormValues } | null>(null);
  protected readonly deleting = signal<Post | null>(null);

  /** Field definitions depend on the plan calendar (month labels) and the selected month. */
  protected readonly fields = computed(() =>
    postFields(this.monthLabel, this.store.filters().month || 1, this.store.strategy()),
  );

  protected readonly selectedStats = computed(() => {
    const month = this.store.filters().month;
    return month ? this.store.monthStats()[month - 1] : null;
  });

  protected pickYear(value: string): void {
    this.store.selectYear(Number(value) || 0);
    this.expanded.set(new Set());
  }

  protected async addYear(): Promise<void> {
    await this.store.addYear();
    this.expanded.set(new Set());
  }

  protected setTab(value: string): void {
    this.tab.set(value === 'content' ? 'content' : 'strategy');
  }

  /** From the strategy's 12-month plan: that month's content. */
  protected showMonth(month: number): void {
    this.selectMonth(month);
    this.tab.set('content');
  }

  protected selectMonth(month: number): void {
    this.store.setFilters({ month });
    this.expanded.set(new Set());
  }

  protected toggle(id: string, open: boolean): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected openNew(): void {
    this.tab.set('content');
    this.form.set({ post: null, values: {} });
  }

  protected openEdit(post: Post): void {
    this.form.set({ post, values: postToForm(post) });
  }

  protected save(values: FormValues): void {
    const data = postFromForm(values);
    const editing = this.form()?.post;
    if (editing) {
      this.store.update(editing.id, data);
      this.toast.show(t('Saved {name}', { name: data.title }));
    } else {
      this.store.add(data);
      this.toast.show(t('Added {name}', { name: data.title }));
    }
  }

  protected setStatus(post: Post, status: PostStatus): void {
    this.store.setStatus(post.id, status);
    this.toast.show(`${status[0].toUpperCase()}${status.slice(1)}: ${post.title || 'item'}`);
  }

  protected duplicate(post: Post): void {
    this.store.duplicate(post);
    this.toast.show(t('Duplicated {name}', { name: post.title || t('item') }));
  }

  protected confirmDelete(post: Post): void {
    this.store.remove(post.id);
    this.toast.show(t('Deleted {name}', { name: post.title || t('item') }));
  }

  protected async copyCaption(post: Post): Promise<void> {
    const text = post.caption + (post.hashtags ? `\n\n${post.hashtags}` : '');
    try {
      await navigator.clipboard.writeText(text);
      this.toast.show('Caption copied');
    } catch {
      this.toast.show('Copy isn’t available here. Select the text and copy it.');
    }
  }
}
