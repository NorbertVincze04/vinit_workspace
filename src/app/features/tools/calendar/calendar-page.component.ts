import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { formatDate, todayISO } from '../../../core/utils/date';
import {
  ButtonComponent,
  ConfirmDialogComponent,
  DialogComponent,
  EmptyStateComponent,
  Fact,
  FactsComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
  IconComponent,
  MonthSwitcherComponent,
  PageHeaderComponent,
  PanelComponent,
  SegmentedComponent,
  StatusPillComponent,
} from '../../../shared/ui';
import { SalonsStore } from '../salons/salons.store';
import { Deadline, categoryLabel, deadlineBody, deadlineFields, monthWeeks, whenInfo } from './calendar.model';
import { CalendarStore } from './calendar.store';
import { MonthGridComponent } from './components/month-grid/month-grid.component';

/** Calendar of deadlines: a month grid (agenda on phones) and the upcoming list. */
@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    MonthSwitcherComponent,
    SegmentedComponent,
    PanelComponent,
    StatusPillComponent,
    EmptyStateComponent,
    FormDialogComponent,
    ConfirmDialogComponent,
    DialogComponent,
    FactsComponent,
    MonthGridComponent,
  ],
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPageComponent {
  protected readonly store = inject(CalendarStore);
  private readonly salons = inject(SalonsStore);
  private readonly toast = inject(ToastService);

  protected readonly view = signal<'month' | 'upcoming'>('month');
  protected readonly views = [
    { value: 'month', label: 'Month' },
    { value: 'upcoming', label: 'Upcoming' },
  ];
  protected readonly month = signal(todayISO().slice(0, 7));
  protected readonly deadlines = signal<Deadline[]>([]);
  protected readonly open = signal<Deadline | null>(null);
  protected readonly form = signal<{ item: Deadline | null; fields: FieldDef[]; values: FormValues } | null>(null);
  protected readonly deleting = signal<Deadline | null>(null);

  protected readonly when = whenInfo;
  protected readonly category = categoryLabel;
  protected readonly date = formatDate;

  /** Agenda for phones: the month's deadlines in date order. */
  protected readonly agenda = computed(() => {
    const m = this.month();
    return this.deadlines().filter((d) => d.dueOn.startsWith(m));
  });

  protected readonly facts = computed<Fact[]>(() => {
    const d = this.open();
    if (!d) return [];
    const w = whenInfo(d);
    return [
      { label: 'Due', value: formatDate(d.dueOn), hint: w.text },
      { label: 'Type', value: categoryLabel(d.category) },
      { label: 'Salon', value: d.salonName ?? '', route: d.salonId ? `/tools/salons/${d.salonId}` : undefined },
      { label: 'Repeats', value: d.recurrence === 'none' ? 'No' : d.recurrence },
      { label: 'Reminders', value: d.remindDays.map((n) => (n ? `${n} days before` : 'on the day')).join(', ') },
      { label: 'From', value: d.sourceType ? 'Generated from the data' : 'Added by hand' },
      { label: 'Link', value: d.url ? 'Open' : '', href: d.url || undefined },
    ];
  });

  constructor() {
    effect(
      () => {
        const m = this.month();
        untracked(() => void this.loadMonth(m));
      },
      { allowSignalWrites: true },
    );
  }

  private async loadMonth(m: string): Promise<void> {
    const weeks = monthWeeks(m);
    this.deadlines.set(await this.store.range(weeks[0][0], weeks.at(-1)![6]));
  }

  private async refresh(): Promise<void> {
    await Promise.all([this.loadMonth(this.month()), this.store.loadUpcoming()]);
  }

  protected setView(v: string): void {
    this.view.set(v === 'upcoming' ? 'upcoming' : 'month');
  }

  protected openForm(item: Deadline | null): void {
    const salons = this.salons.salons().filter((s) => s.status !== 'churned').map((s) => ({ value: s.id, label: s.name }));
    this.open.set(null);
    this.form.set({
      item,
      fields: deadlineFields(salons),
      values: item
        ? { title: item.title, dueOn: item.dueOn, category: item.category, recurrence: item.recurrence, remindDays: item.remindDays.join(', '), salonId: item.salonId ?? '', url: item.url, notes: item.notes }
        : {},
    });
  }

  protected async save(v: FormValues): Promise<void> {
    const f = this.form();
    try {
      if (f?.item) await this.store.update(f.item.id, deadlineBody(v));
      else await this.store.create(deadlineBody(v));
      this.toast.show('Deadline saved');
      await this.refresh();
    } catch {
      /* toast shown */
    }
  }

  protected async markDone(d: Deadline, dialog?: DialogComponent): Promise<void> {
    try {
      const next = await this.store.done(d);
      this.toast.show(next ? `Done. Next one on ${formatDate(next)}` : 'Done');
      dialog?.close();
      await this.refresh();
    } catch {
      /* toast shown */
    }
  }

  protected async setStatus(d: Deadline, status: 'open' | 'dismissed', dialog?: DialogComponent): Promise<void> {
    try {
      await this.store.update(d.id, { status });
      this.toast.show(status === 'dismissed' ? 'Dismissed' : 'Open again');
      dialog?.close();
      await this.refresh();
    } catch {
      /* toast shown */
    }
  }

  protected async confirmDelete(d: Deadline): Promise<void> {
    try {
      await this.store.remove(d);
      this.toast.show('Deadline deleted');
      await this.refresh();
    } catch {
      /* toast shown */
    }
  }
}
