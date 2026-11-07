import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlanCalendarService } from '../../../core/services/plan-calendar.service';
import { ToastService } from '../../../core/services/toast.service';
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
  TextFieldComponent,
} from '../../../shared/ui';
import { MarketingOverviewComponent } from './components/marketing-overview/marketing-overview.component';
import { MonthBriefComponent } from './components/month-brief/month-brief.component';
import { MonthRailComponent } from './components/month-rail/month-rail.component';
import { PostItemComponent } from './components/post-item/post-item.component';
import { FORMATS, MONTH_PLAN } from './marketing.data';
import { postFields, postFromForm, postToForm } from './marketing.fields';
import { Post, PostStatus } from './marketing.model';
import { MarketingStore } from './marketing.store';

/** Marketing plan tool: the 12-month content calendar from Annex 3. */
@Component({
  selector: 'app-marketing-page',
  standalone: true,
  imports: [
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
  ],
  templateUrl: './marketing-page.component.html',
  styleUrl: './marketing-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingPageComponent {
  protected readonly store = inject(MarketingStore);
  protected readonly plan = inject(PlanCalendarService);
  private readonly toast = inject(ToastService);

  protected readonly monthPlan = MONTH_PLAN;
  protected readonly formatOptions: readonly SelectOption[] = [{ value: 'all', label: 'All formats' }, ...FORMATS];
  protected readonly monthLabel = (n: number): string => this.plan.monthLabel(n);

  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected readonly form = signal<{ post: Post | null; values: FormValues } | null>(null);
  protected readonly deleting = signal<Post | null>(null);

  /** Field definitions depend on the plan calendar (month labels) and the selected month. */
  protected readonly fields = computed(() =>
    postFields(this.monthLabel, this.store.filters().month || 1),
  );

  protected readonly selectedStats = computed(() => {
    const month = this.store.filters().month;
    return month ? this.store.monthStats()[month - 1] : null;
  });

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
      this.toast.show(`Saved ${data.title}`);
    } else {
      this.store.add(data);
      this.toast.show(`Added ${data.title}`);
    }
  }

  protected setStatus(post: Post, status: PostStatus): void {
    this.store.setStatus(post.id, status);
    this.toast.show(`${status[0].toUpperCase()}${status.slice(1)}: ${post.title || 'item'}`);
  }

  protected duplicate(post: Post): void {
    this.store.duplicate(post);
    this.toast.show(`Duplicated ${post.title || 'item'}`);
  }

  protected confirmDelete(post: Post): void {
    this.store.remove(post.id);
    this.toast.show(`Deleted ${post.title || 'item'}`);
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
