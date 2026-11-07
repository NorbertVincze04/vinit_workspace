import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiError } from '../../../../../core/api/api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { formatDateTime } from '../../../../../core/utils/date';
import {
  ButtonComponent,
  DialogComponent,
  Fact,
  FactsComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
} from '../../../../../shared/ui';
import { timeBody, timeFields } from '../../support.fields';
import { TICKET_STATUSES, Ticket, TimeEntry, duration, priorityInfo, ticketNo, ticketStatus, typeLabel } from '../../support.model';
import { SupportStore } from '../../support.store';
import { FeaturesStore } from '../../../features/features.store';
import { TimeListComponent } from '../time-list/time-list.component';

/** A ticket opened: details, quick status change, time logged on it and "log time". */
@Component({
  selector: 'app-ticket-dialog',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, FactsComponent, FormDialogComponent, TimeListComponent, RouterLink],
  template: `
    <app-dialog #dialog size="lg" [heading]="heading()" [subheading]="ticket()?.title ?? ''" (closed)="closed.emit()">
      @if (ticket(); as t) {
        <div class="top">
          <label class="status">
            <span>Status</span>
            <select class="input" [value]="t.status" (change)="setStatus($any($event.target))">
              @for (s of statuses; track s.value) {
                <option [value]="s.value" [selected]="s.value === t.status">{{ s.label }}</option>
              }
            </select>
          </label>
          <a class="salon" [routerLink]="['/tools/salons', t.salonId]" [queryParams]="{ tab: 'support' }" (click)="dialog.close()">{{ t.salonName }} →</a>
        </div>
        <app-facts [items]="facts()" />
        @if (t.description) {
          <p class="desc">{{ t.description }}</p>
        }
        @if (t.featureRequestId) {
          <p class="fr">Feature request: <a routerLink="/tools/features" (click)="dialog.close()">{{ t.featureRequestTitle }}</a></p>
        } @else if (t.type === 'change_request') {
          <p class="fr">
            Other salons may want this too.
            <button appButton size="sm" variant="ghost" type="button" (click)="toFeature()">Make it a feature request</button>
          </p>
        }
        <div class="time-head">
          <h3>Time · {{ total() }}</h3>
          <button appButton size="sm" type="button" (click)="openLog()">Log time</button>
        </div>
        @if (entries(); as list) {
          <app-time-list [entries]="list" [showTicket]="false" (remove)="removeEntry($event)" />
        }
      } @else {
        <p class="muted">Loading…</p>
      }
      <div dialogFooter class="footer">
        @if (ticket(); as t) {
          <button appButton variant="ghost" type="button" (click)="remove.emit(t)">Delete</button>
          <span class="spacer"></span>
          <button appButton type="button" (click)="edit.emit(t)">Edit</button>
          @if (t.status !== 'resolved' && t.status !== 'closed') {
            <button appButton variant="primary" type="button" (click)="setStatusValue('resolved')">Mark resolved</button>
          }
        }
      </div>
    </app-dialog>

    @if (logFields(); as fields) {
      <app-form-dialog size="sm" heading="Log time" [subheading]="heading()" [fields]="fields" saveLabel="Log time" (saved)="log($event)" (closed)="logFields.set(null)" />
    }
  `,
  styles: `
    .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
    .status { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--muted); }
    .status .input { width: auto; }
    .salon { font-weight: 600; color: var(--main); text-decoration: none; }
    .desc { white-space: pre-line; font-size: 14px; margin-top: 14px; }
    .fr { font-size: 13.5px; color: var(--muted); margin-top: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .fr a { color: var(--main); font-weight: 600; text-decoration: none; }
    .time-head { display: flex; align-items: center; justify-content: space-between; margin: 18px 0 8px; }
    h3 { font-size: 14px; font-weight: 600; }
    .footer { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; }
    .spacer { flex: 1; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketDialogComponent {
  readonly ticketId = input.required<string>();
  readonly edit = output<Ticket>();
  readonly remove = output<Ticket>();
  readonly closed = output<void>();

  private readonly store = inject(SupportStore);
  private readonly toast = inject(ToastService);
  private readonly features = inject(FeaturesStore);

  protected readonly ticket = signal<Ticket | null>(null);
  protected readonly entries = signal<TimeEntry[] | null>(null);
  protected readonly logFields = signal<FieldDef[] | null>(null);
  protected readonly statuses = TICKET_STATUSES;

  protected readonly heading = computed(() => (this.ticket() ? ticketNo(this.ticket()!.number) : 'Ticket'));
  protected readonly total = computed(() => duration((this.entries() ?? []).reduce((s, e) => s + e.minutes, 0)));
  protected readonly facts = computed<Fact[]>(() => {
    const t = this.ticket();
    if (!t) return [];
    const status = ticketStatus(t.status);
    const priority = priorityInfo(t.priority);
    return [
      { label: 'Type', value: typeLabel(t.type) },
      { label: 'Priority', value: priority.label, tone: t.priority === 'urgent' || t.priority === 'high' ? priority.tone : undefined },
      { label: 'Status', value: status.label, tone: status.tone },
      { label: 'Assigned to', value: t.assigneeName ?? '' },
      { label: 'Opened', value: formatDateTime(t.openedAt) },
      { label: 'Resolved', value: formatDateTime(t.resolvedAt) },
    ];
  });

  constructor() {
    effect(
      () => {
        const id = this.ticketId();
        untracked(() => void this.load(id));
      },
      { allowSignalWrites: true },
    );
  }

  /** Reload after a change made by the page (edit). */
  refresh(): void {
    void this.load(this.ticketId());
  }

  private async load(id: string): Promise<void> {
    try {
      const res = await this.store.ticket(id);
      this.ticket.set(res.item);
      this.entries.set(res.entries);
    } catch (e) {
      this.toast.show(`Could not load the ticket: ${apiError(e).message}`, 6000);
    }
  }

  protected async setStatus(select: HTMLSelectElement): Promise<void> {
    const value = select.value;
    select.value = this.ticket()?.status ?? value;
    await this.setStatusValue(value);
  }

  protected async setStatusValue(status: string): Promise<void> {
    const t = this.ticket();
    if (!t || t.status === status) return;
    try {
      this.ticket.set(await this.store.updateTicket(t, { status }));
      this.toast.show(`${ticketNo(t.number)}: ${ticketStatus(status).label.toLowerCase()}`);
    } catch {
      /* toast shown */
    }
  }

  protected async toFeature(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    try {
      await this.features.fromTicket(t.id);
      this.toast.show('Feature request created, with this salon as the first vote');
      await this.load(t.id);
    } catch {
      /* toast shown */
    }
  }

  protected async openLog(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    let remaining: number | null = null;
    try {
      remaining = (await this.store.sessions(t.salonId)).remaining;
    } catch {
      /* the server checks again when saving */
    }
    this.logFields.set(timeFields(remaining, null));
  }

  protected async log(v: FormValues): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    try {
      await this.store.logTime(t.salonId, { ...timeBody(v), ticketId: t.id });
      this.toast.show('Time logged');
      await this.load(t.id);
    } catch {
      /* toast shown */
    }
  }

  protected async removeEntry(e: TimeEntry): Promise<void> {
    try {
      await this.store.removeEntry(e);
      await this.load(this.ticketId());
    } catch {
      /* toast shown */
    }
  }
}
