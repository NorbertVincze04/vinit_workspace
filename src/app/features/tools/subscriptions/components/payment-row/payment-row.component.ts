import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDate } from '../../../../../core/utils/date';
import { RonPipe } from '../../../../../shared/pipes/ron.pipe';
import { ButtonComponent, LedgerRowComponent, MenuComponent, MenuItemComponent, StatusPillComponent } from '../../../../../shared/ui';
import { Payment, kindLabel, paymentStatus } from '../../billing.model';

export type PaymentAction = 'paid' | 'reopen' | 'waive' | 'delete';

/** One payment: salon, what for, amount, due date, status and the next action. */
@Component({
  selector: 'app-payment-row',
  standalone: true,
  imports: [LedgerRowComponent, StatusPillComponent, ButtonComponent, MenuComponent, MenuItemComponent, RonPipe, RouterLink],
  template: `
    <app-ledger-row>
      @if (showSalon()) {
        <div>
          <a class="cell-title link" [routerLink]="['/tools/salons', payment().salonId]">{{ payment().salonName }}</a>
          <span class="cell-sub">{{ what() }}</span>
        </div>
      } @else {
        <div>
          <span class="cell-title">{{ what() }}</span>
          @if (payment().invoiceNumber) {
            <span class="cell-sub">Invoice {{ payment().invoiceNumber }}</span>
          }
        </div>
      }
      <span class="cell-num">{{ payment().amount | ron }}</span>
      <div>
        <span>{{ due() }}</span>
        @if (payment().paidOn) {
          <span class="cell-sub">paid {{ paid() }}</span>
        }
      </div>
      <div><app-status-pill [tone]="status().tone">{{ status().label }}</app-status-pill></div>
      <div class="cell-actions">
        @if (payment().status === 'due') {
          <button appButton size="sm" type="button" (click)="act.emit('paid')">Mark paid</button>
        }
        <app-menu [ariaLabel]="'More actions for ' + what()">
          @if (payment().status === 'paid') {
            <button appMenuItem type="button" (click)="act.emit('reopen')">Mark not paid</button>
          } @else {
            @if (payment().status === 'due') {
              <button appMenuItem type="button" (click)="act.emit('waive')">Waive (free)</button>
            }
            <button appMenuItem tone="danger" type="button" (click)="act.emit('delete')">Delete…</button>
          }
        </app-menu>
      </div>
    </app-ledger-row>
  `,
  styles: `
    :host { display: block; }
    .link { color: inherit; text-decoration: none; }
    .link:hover { color: var(--main); text-decoration: underline; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentRowComponent {
  readonly payment = input.required<Payment>();
  readonly showSalon = input(true);
  readonly act = output<PaymentAction>();

  protected readonly status = computed(() => paymentStatus(this.payment()));
  protected readonly due = computed(() => formatDate(this.payment().dueOn));
  protected readonly paid = computed(() => formatDate(this.payment().paidOn));
  protected readonly what = computed(() => {
    const p = this.payment();
    const period = p.periodStart
      ? `${formatDate(p.periodStart, { day: 'numeric', month: 'short' })} – ${formatDate(p.periodEnd, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : '';
    return [kindLabel(p.kind), period].filter(Boolean).join(' · ');
  });
}
