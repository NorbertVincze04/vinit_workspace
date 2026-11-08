import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { TeamService } from '../../../core/auth/team.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { todayISO } from '../../../core/utils/date';
import {
  ButtonComponent,
  ChipGroupComponent,
  ChipOption,
  ConfirmDialogComponent,
  EmptyStateComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
  IconComponent,
  InlineStat,
  InlineStatsComponent,
  LedgerComponent,
  PageHeaderComponent,
  PanelComponent,
  TabsComponent,
  toFormValues,
} from '../../../shared/ui';
import { SalonsStore } from '../salons/salons.store';
import { TicketDialogComponent } from './components/ticket-dialog/ticket-dialog.component';
import { TicketRowComponent } from './components/ticket-row/ticket-row.component';
import { TimeListComponent } from './components/time-list/time-list.component';
import { ticketBody, ticketFields } from './support.fields';
import { OPEN_STATUSES, Ticket, TimeEntry, duration, ticketNo } from './support.model';
import { SupportStore } from './support.store';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/** Support tool: tickets from salons and the time spent on them. */
@Component({
  selector: 'app-support-page',
  standalone: true,
  imports: [TPipe, 
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    TabsComponent,
    ChipGroupComponent,
    InlineStatsComponent,
    LedgerComponent,
    PanelComponent,
    EmptyStateComponent,
    FormDialogComponent,
    ConfirmDialogComponent,
    TicketRowComponent,
    TicketDialogComponent,
    TimeListComponent,
  ],
  templateUrl: './support-page.component.html',
  styles: '.summary { display: flex; margin-bottom: 12px; } .tab-body { margin-top: 16px; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportPageComponent {
  protected readonly store = inject(SupportStore);
  private readonly salons = inject(SalonsStore);
  private readonly team = inject(TeamService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly tab = signal('tickets');
  protected readonly filter = signal('open');
  protected readonly openId = signal<string | null>(null);
  protected readonly form = signal<{ ticket: Ticket | null; fields: FieldDef[]; values: FormValues } | null>(null);
  protected readonly deleting = signal<Ticket | null>(null);
  private readonly detail = viewChild(TicketDialogComponent);

  protected readonly month = todayISO().slice(0, 7);
  protected readonly no = ticketNo;

  protected readonly tabs = computed<ChipOption[]>(() => [
    { value: 'tickets', label: 'Tickets', count: this.store.open().length },
    { value: 'time', label: 'Time log' },
  ]);

  protected readonly chips = computed<ChipOption[]>(() => {
    const all = this.store.tickets();
    return [
      { value: 'open', label: 'Open', count: this.store.open().length },
      { value: 'waiting_client', label: 'Waiting on client', count: all.filter((t) => t.status === 'waiting_client').length },
      { value: 'done', label: 'Resolved', count: all.filter((t) => !OPEN_STATUSES.includes(t.status)).length },
      { value: 'all', label: 'All', count: all.length },
    ];
  });

  protected readonly visible = computed(() => {
    const f = this.filter();
    return this.store
      .tickets()
      .filter((t) => (f === 'open' ? OPEN_STATUSES.includes(t.status) : f === 'done' ? !OPEN_STATUSES.includes(t.status) : f === 'all' ? true : t.status === f));
  });

  protected readonly thisMonth = computed<TimeEntry[]>(() => this.store.recentEntries().filter((e) => e.workedOn.startsWith(this.month)));

  protected readonly summary = computed<InlineStat[]>(() => {
    const month = this.thisMonth();
    const minutes = (kind?: string) => month.filter((e) => !kind || e.kind === kind).reduce((s, e) => s + e.minutes, 0);
    return [
      { label: 'Open tickets', value: String(this.store.open().length) },
      { label: 'Urgent or high', value: String(this.store.urgent().length), tone: this.store.urgent().length ? 'negative' : 'default' },
      { label: 'Time this month', value: duration(minutes()) },
      { label: 'Billable', value: duration(minutes('billable')) },
      { label: 'Included sessions', value: String(month.filter((e) => e.kind === 'included_session').length) },
    ];
  });

  constructor() {
    if (this.store.loaded()) void this.store.reload();
  }

  protected openNew(): void {
    const salons = this.salons.salons().filter((s) => s.status !== 'churned').map((s) => ({ value: s.id, label: s.name }));
    this.form.set({ ticket: null, fields: ticketFields(salons, this.team.options(), false, this.auth.user()?.id ?? ''), values: {} });
  }

  protected openEdit(ticket: Ticket): void {
    this.form.set({ ticket, fields: ticketFields(null, this.team.options(), true), values: { ...toFormValues(ticket), assigneeId: ticket.assigneeId ?? '' } });
  }

  protected async save(values: FormValues): Promise<void> {
    const f = this.form();
    if (!f) return;
    try {
      if (f.ticket) {
        await this.store.updateTicket(f.ticket, ticketBody(values, true));
        this.toast.show('Ticket saved');
        this.detail()?.refresh();
      } else {
        const created = await this.store.createTicket(ticketBody(values, false));
        this.toast.show(t('{ticket} opened', { ticket: ticketNo(created.number) }));
      }
    } catch {
      /* toast shown */
    }
  }

  protected async confirmDelete(ticket: Ticket): Promise<void> {
    try {
      await this.store.removeTicket(ticket);
      this.openId.set(null);
      this.toast.show(t('{ticket} deleted', { ticket: ticketNo(ticket.number) }));
    } catch {
      /* toast shown */
    }
  }

  protected async removeEntry(e: TimeEntry): Promise<void> {
    try {
      await this.store.removeEntry(e);
    } catch {
      /* toast shown */
    }
  }
}
