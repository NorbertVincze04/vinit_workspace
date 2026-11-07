import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDate } from '../../../../../core/utils/date';
import { formatMoney } from '../../../../../core/utils/format';
import { TimeEntry, duration, entryKindLabel, ticketNo } from '../../support.model';

/** Logged time, newest first: date, what, who, minutes, and the money for billable time. */
@Component({
  selector: 'app-time-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    <ul>
      @for (e of entries(); track e.id) {
        <li>
          <span class="when">{{ date(e.workedOn) }}</span>
          <span class="what">
            <strong>{{ kind(e.kind) }}</strong>
            @if (showSalon()) {
              · <a [routerLink]="['/tools/salons', e.salonId]" [queryParams]="{ tab: 'support' }">{{ e.salonName }}</a>
            }
            @if (e.ticketNumber && showTicket()) {
              · {{ no(e.ticketNumber) }}
            }
            @if (e.description) {
              · {{ e.description }}
            }
            <span class="muted">{{ e.userName ? ' · ' + e.userName : '' }}</span>
          </span>
          <span class="mins">
            {{ dur(e.minutes) }}
            @if (e.kind === 'billable') {
              <span class="money" [class.billed]="!!e.billedPaymentId">{{ money(e.amountBani / 100) }}{{ e.billedPaymentId ? ' · billed' : '' }}</span>
            }
          </span>
          @if (e.billedPaymentId) {
            <span></span>
          } @else if (confirming() === e.id) {
            <span class="confirm">
              Delete?
              <button type="button" class="yes" (click)="confirming.set(null); remove.emit(e)">Yes</button>
              <button type="button" (click)="confirming.set(null)">No</button>
            </span>
          } @else {
            <button class="remove" type="button" [attr.aria-label]="'Delete ' + dur(e.minutes) + ' on ' + date(e.workedOn)" (click)="confirming.set(e.id)">×</button>
          }
        </li>
      } @empty {
        <li class="muted empty">No time logged yet.</li>
      }
    </ul>
  `,
  styles: `
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; font-size: 14px; }
    li { display: grid; grid-template-columns: 90px minmax(0, 1fr) auto 28px; gap: 10px; align-items: baseline; }
    li.empty { display: block; }
    .when { color: var(--muted); font-variant-numeric: tabular-nums; }
    .what { overflow-wrap: anywhere; }
    .what a { color: var(--main); text-decoration: none; }
    .mins { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; display: grid; }
    .money { font-size: 12.5px; color: var(--muted); }
    .money.billed { color: var(--good); }
    .remove { width: 28px; height: 28px; font-size: 18px; line-height: 1; color: var(--muted); background: none; border: 0;
      border-radius: var(--radius-md); cursor: pointer; opacity: 0.5; }
    .remove:hover, .remove:focus-visible { opacity: 1; background: var(--hover); }
    .confirm { grid-column: 1 / -1; justify-self: end; display: inline-flex; gap: 8px; align-items: center; font-size: 13px; }
    .confirm button { font: inherit; padding: 2px 10px; border: 1px solid var(--line-strong); border-radius: var(--radius-md); background: var(--surface); color: var(--ink); cursor: pointer; }
    .confirm .yes { color: var(--red); border-color: var(--red); }
    @media (max-width: 560px) { li { grid-template-columns: minmax(0, 1fr) auto 28px; } .when { grid-column: 1 / -1; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeListComponent {
  readonly entries = input.required<readonly TimeEntry[]>();
  readonly showSalon = input(false);
  readonly showTicket = input(true);
  readonly remove = output<TimeEntry>();
  /** Entry waiting for "Delete? Yes / No". */
  protected readonly confirming = signal<string | null>(null);

  protected readonly date = (iso: string) => formatDate(iso, { day: 'numeric', month: 'short' });
  protected readonly kind = entryKindLabel;
  protected readonly dur = duration;
  protected readonly money = (ron: number) => formatMoney(ron);
  protected readonly no = ticketNo;
}
