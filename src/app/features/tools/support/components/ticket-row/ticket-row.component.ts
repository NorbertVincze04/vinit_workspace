import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { formatDate } from '../../../../../core/utils/date';
import { LedgerRowComponent, StatusPillComponent } from '../../../../../shared/ui';
import { Ticket, duration, priorityInfo, ticketNo, ticketStatus, typeLabel } from '../../support.model';

/** One ticket: number and title, salon, priority, status, time spent. */
@Component({
  selector: 'app-ticket-row',
  standalone: true,
  imports: [LedgerRowComponent, StatusPillComponent],
  template: `
    <app-ledger-row clickable (activate)="open.emit()">
      <div>
        <span class="cell-title"><span class="no">{{ no() }}</span> {{ ticket().title }}</span>
        <span class="cell-sub">{{ sub() }}</span>
      </div>
      <div>
        @if (ticket().priority === 'urgent' || ticket().priority === 'high') {
          <app-status-pill [tone]="priority().tone">{{ priority().label }}</app-status-pill>
        } @else {
          <span class="cell-sub">{{ priority().label }}</span>
        }
      </div>
      <div><app-status-pill [tone]="status().tone">{{ status().label }}</app-status-pill></div>
      <span class="cell-num">{{ time() }}</span>
    </app-ledger-row>
  `,
  styles: `
    :host { display: block; }
    .no { color: var(--muted); font-weight: 500; font-variant-numeric: tabular-nums; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketRowComponent {
  readonly ticket = input.required<Ticket>();
  readonly showSalon = input(true);
  readonly open = output<void>();

  protected readonly no = computed(() => ticketNo(this.ticket().number));
  protected readonly status = computed(() => ticketStatus(this.ticket().status));
  protected readonly priority = computed(() => priorityInfo(this.ticket().priority));
  protected readonly time = computed(() => (this.ticket().minutesLogged ? duration(this.ticket().minutesLogged) : '—'));
  protected readonly sub = computed(() => {
    const t = this.ticket();
    return [this.showSalon() ? t.salonName : '', typeLabel(t.type), `opened ${formatDate(t.openedAt.slice(0, 10), { day: 'numeric', month: 'short' })}`, t.assigneeName]
      .filter(Boolean)
      .join(' · ');
  });
}
