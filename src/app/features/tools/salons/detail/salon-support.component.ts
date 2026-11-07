import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TeamService } from '../../../../core/auth/team.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { formatMoney } from '../../../../core/utils/format';
import {
  ButtonComponent,
  ConfirmDialogComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
  LedgerComponent,
  MeterComponent,
  PanelComponent,
  toFormValues,
} from '../../../../shared/ui';
import { TicketDialogComponent } from '../../support/components/ticket-dialog/ticket-dialog.component';
import { TicketRowComponent } from '../../support/components/ticket-row/ticket-row.component';
import { TimeListComponent } from '../../support/components/time-list/time-list.component';
import { ticketBody, ticketFields, timeBody, timeFields } from '../../support/support.fields';
import { OPEN_STATUSES, SalonSupport, Ticket, TimeEntry, duration, ticketNo } from '../../support/support.model';
import { SupportStore } from '../../support/support.store';

/** Salon page tab: included sessions left, unbilled extra work, tickets and logged time. */
@Component({
  selector: 'app-salon-support',
  standalone: true,
  imports: [PanelComponent, ButtonComponent, MeterComponent, LedgerComponent, FormDialogComponent, ConfirmDialogComponent, TicketRowComponent, TicketDialogComponent, TimeListComponent],
  template: `
    @if (support(); as s) {
      <div class="grid">
        <app-panel heading="Included sessions" [meta]="s.sessions.planName ?? 'No plan'">
          <div class="big">
            <strong>{{ s.sessions.remaining }}</strong> of {{ s.sessions.included }} left
          </div>
          <app-meter [value]="usedPercent()" [label]="s.sessions.used + ' of ' + s.sessions.included + ' included sessions used'" />
          <p class="small muted">
            Counted per meeting ({{ s.sessions.sessionMinutes }} min each, one-time per contract). Used {{ s.sessions.used }}, {{ dur(s.sessions.sessionMinutesUsed) }} in total.
          </p>
        </app-panel>

        <app-panel heading="Extra work" meta="100 RON/h, exact minutes">
          <div class="big">
            <strong>{{ money(s.sessions.unbilledBani / 100) }}</strong> not billed yet
          </div>
          <p class="small muted">
            {{ dur(s.sessions.unbilledMinutes) }} unbilled · {{ dur(s.sessions.billableMinutes) }} billable in total · {{ dur(s.sessions.internalMinutes) }} internal
          </p>
          @if (s.sessions.unbilledBani > 0) {
            <button appButton size="sm" type="button" (click)="billing.set(true)">Bill extra work</button>
          }
        </app-panel>
      </div>

      <app-panel class="block" heading="Tickets" [meta]="openCount() + ' open'" [flush]="s.tickets.length > 0">
        <button panelAction appButton variant="ghost" size="sm" type="button" (click)="newTicket()">New ticket</button>
        @if (s.tickets.length) {
          <app-ledger [headers]="['Ticket', 'Priority', 'Status', 'Time']" [numeric]="[3]" columns="minmax(0, 2.4fr) 100px 150px 80px">
            @for (t of s.tickets; track t.id) {
              <app-ticket-row [ticket]="t" [showSalon]="false" (open)="openId.set(t.id)" />
            }
          </app-ledger>
        } @else {
          <p class="small muted pad">No tickets for this salon.</p>
        }
      </app-panel>

      <app-panel class="block" heading="Time" [meta]="dur(totalMinutes())">
        <button panelAction appButton variant="ghost" size="sm" type="button" (click)="logTime()">Log time</button>
        <app-time-list [entries]="s.entries" (remove)="removeEntry($event)" />
      </app-panel>
    }

    @if (openId(); as id) {
      <app-ticket-dialog [ticketId]="id" (edit)="editTicket($event)" (remove)="deleting.set($event)" (closed)="openId.set(null); changed.emit()" />
    }

    @if (form(); as f) {
      <app-form-dialog [heading]="f.title" [fields]="f.fields" [initial]="f.values" [saveLabel]="f.save" (saved)="saved($event)" (closed)="form.set(null)" />
    }

    @if (billing()) {
      <app-confirm-dialog
        heading="Bill extra work?"
        [message]="'A payment of ' + money((support()?.sessions?.unbilledBani ?? 0) / 100) + ' for ' + dur(support()?.sessions?.unbilledMinutes ?? 0) + ' of extra work is added (due in 14 days). You find it under Subscription & payments.'"
        confirmLabel="Create payment"
        cancelLabel="Not now"
        (confirmed)="bill()"
        (closed)="billing.set(false)"
      />
    }

    @if (deleting(); as t) {
      <app-confirm-dialog
        heading="Delete ticket?"
        [message]="no(t.number) + ' “' + t.title + '” will be removed. Time logged on it stays on the salon.'"
        cancelLabel="Keep it"
        (confirmed)="deleteTicket(t)"
        (closed)="deleting.set(null)"
      />
    }
  `,
  styles: `
    :host { display: grid; gap: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: 16px; align-items: start; }
    .big { font-size: 15px; }
    .big strong { font-size: 22px; font-weight: 650; font-variant-numeric: tabular-nums; }
    .pad { padding: 16px 18px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalonSupportComponent {
  readonly support = input<SalonSupport | null>(null);
  readonly salonId = input.required<string>();
  readonly changed = output<void>();

  private readonly store = inject(SupportStore);
  private readonly team = inject(TeamService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly openId = signal<string | null>(null);
  protected readonly billing = signal(false);
  protected readonly deleting = signal<Ticket | null>(null);
  protected readonly form = signal<{ kind: 'ticket' | 'time'; ticket: Ticket | null; title: string; save: string; fields: FieldDef[]; values: FormValues } | null>(null);

  protected readonly dur = duration;
  protected readonly money = (ron: number) => formatMoney(ron);
  protected readonly no = ticketNo;
  protected readonly openCount = computed(() => (this.support()?.tickets ?? []).filter((t) => OPEN_STATUSES.includes(t.status)).length);
  protected readonly totalMinutes = computed(() => (this.support()?.entries ?? []).reduce((s, e) => s + e.minutes, 0));
  protected readonly usedPercent = computed(() => {
    const s = this.support()?.sessions;
    return s?.included ? Math.round((s.used / s.included) * 100) : 0;
  });

  protected newTicket(): void {
    this.form.set({ kind: 'ticket', ticket: null, title: 'New ticket', save: 'Open ticket', fields: ticketFields(null, this.team.options(), false, this.auth.user()?.id ?? ''), values: {} });
  }

  protected editTicket(ticket: Ticket): void {
    this.form.set({
      kind: 'ticket',
      ticket,
      title: `Edit ${ticketNo(ticket.number)}`,
      save: 'Save ticket',
      fields: ticketFields(null, this.team.options(), true),
      values: { ...toFormValues(ticket), assigneeId: ticket.assigneeId ?? '' },
    });
  }

  protected logTime(): void {
    const s = this.support();
    const open = (s?.tickets ?? []).filter((t) => OPEN_STATUSES.includes(t.status));
    this.form.set({ kind: 'time', ticket: null, title: 'Log time', save: 'Log time', fields: timeFields(s?.sessions.remaining ?? null, open), values: {} });
  }

  protected async saved(v: FormValues): Promise<void> {
    const f = this.form();
    if (!f) return;
    try {
      if (f.kind === 'time') {
        await this.store.logTime(this.salonId(), timeBody(v));
        this.toast.show('Time logged');
      } else if (f.ticket) {
        await this.store.updateTicket(f.ticket, ticketBody(v, true));
        this.toast.show('Ticket saved');
        this.openId.set(null);
      } else {
        const t = await this.store.createTicket({ ...ticketBody(v, false), salonId: this.salonId() });
        this.toast.show(`${ticketNo(t.number)} opened`);
      }
      this.changed.emit();
    } catch {
      /* toast shown */
    }
  }

  protected async bill(): Promise<void> {
    try {
      const amount = await this.store.billExtraWork(this.salonId());
      this.toast.show(`Payment of ${formatMoney(amount)} created`);
      this.changed.emit();
    } catch {
      /* toast shown */
    }
  }

  protected async removeEntry(e: TimeEntry): Promise<void> {
    try {
      await this.store.removeEntry(e);
      this.changed.emit();
    } catch {
      /* toast shown */
    }
  }

  protected async deleteTicket(t: Ticket): Promise<void> {
    try {
      await this.store.removeTicket(t);
      this.openId.set(null);
      this.changed.emit();
    } catch {
      /* toast shown */
    }
  }
}
