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
import { Deadline, categoryLabel, deadlineBody, deadlineFields, deadlineValues, monthWeeks, reminderLabel, timeLabel, whenInfo } from './calendar.model';
import { CalendarStore } from './calendar.store';
import { MonthGridComponent } from './components/month-grid/month-grid.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/** Calendar of deadlines: a month grid (agenda on phones) and the upcoming list. */
const REPEATS: Record<Deadline['recurrence'], string> = { none: 'Never', monthly: 'Every month', quarterly: 'Every 3 months', yearly: 'Every year' };

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [TPipe, 
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
  protected readonly time = timeLabel;

  /** Phones: the day tapped in the grid (its deadlines are listed under it). */
  protected readonly picked = signal<string | null>(null);

  /** Agenda for phones: the picked day, or the month's deadlines in date order. */
  protected readonly agenda = computed(() => {
    const day = this.picked();
    const m = this.month();
    return this.deadlines().filter((d) => (day ? d.dueOn === day : d.dueOn.startsWith(m)));
  });

  /** Desktop: a tapped day opens New deadline on it. Phones: the day is picked and listed first. */
  protected pickDay(day: string): void {
    if (window.matchMedia('(max-width: 720px)').matches) this.picked.set(this.picked() === day ? null : day);
    else this.newOn(day);
  }

  protected readonly facts = computed<Fact[]>(() => {
    const d = this.open();
    if (!d) return [];
    const w = whenInfo(d);
    return [
      { label: 'Due', value: `${formatDate(d.dueOn)} · ${timeLabel(d)}`, hint: w.text },
      { label: 'Type', value: categoryLabel(d.category) },
      { label: 'Salon', value: d.salonName ?? '', route: d.salonId ? `/tools/salons/${d.salonId}` : undefined },
      { label: 'Repeats', value: t(REPEATS[d.recurrence]) },
      { label: 'Reminders', value: d.reminders.length ? d.reminders.map((m) => reminderLabel(m, d.allDay)).join(', ') : t('None') },
      { label: 'From', value: t(d.sourceType ? 'Generated from the data' : 'Added by hand') },
      { label: 'Link', value: d.url ? t('Open') : '', href: d.url || undefined },
    ];
  });

  constructor() {
    effect(
      () => {
        const m = this.month();
        untracked(() => {
          this.picked.set(null);
          void this.loadMonth(m);
        });
      },
      { allowSignalWrites: true },
    );
  }

  private async loadMonth(m: string): Promise<void> {
    const weeks = monthWeeks(m);
    const items = await this.store.range(weeks[0][0], weeks.at(-1)![6]);
    // Paging quickly: a slow answer for an earlier month must not replace the current one.
    if (this.month() === m) this.deadlines.set(items);
  }

  private async refresh(): Promise<void> {
    await Promise.all([this.loadMonth(this.month()), this.store.loadUpcoming()]);
  }

  protected setView(v: string): void {
    this.view.set(v === 'upcoming' ? 'upcoming' : 'month');
  }

  /** New deadline on a day of the month grid. */
  protected newOn(day: string): void {
    this.openForm(null, day);
  }

  protected openForm(item: Deadline | null, day?: string): void {
    const salons = this.salons.salons().filter((s) => s.status !== 'churned').map((s) => ({ value: s.id, label: s.name }));
    this.open.set(null);
    this.form.set({
      item,
      fields: deadlineFields(salons, item?.reminders ?? []),
      values: item ? deadlineValues(item) : day ? { dueOn: day } : {},
    });
  }

  /** Throws on failure, so the form stays open with the server's message (nothing typed is lost). */
  protected readonly save = async (v: FormValues): Promise<void> => {
    const f = this.form();
    if (f?.item) await this.store.update(f.item.id, deadlineBody(v));
    else await this.store.create(deadlineBody(v));
    this.toast.show('Deadline saved');
    void this.refresh();
  };

  protected async markDone(d: Deadline, dialog?: DialogComponent): Promise<void> {
    try {
      const next = await this.store.done(d);
      this.toast.show(next ? t('Done. Next one on {date}', { date: formatDate(next) }) : t('Done'));
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
