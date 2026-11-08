import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { fromApi } from '../../../../core/api/api-fields';
import { formatDate } from '../../../../core/utils/date';
import { formatRon } from '../../../../core/utils/format';
import {
  ButtonComponent,
  EmptyStateComponent,
  Fact,
  FactsComponent,
  LedgerComponent,
  MenuComponent,
  MenuItemComponent,
  PanelComponent,
} from '../../../../shared/ui';
import {
  CHANGES_FOR,
  CHANGE_ACTIONS,
  CHANGE_LABELS,
  ChangeKind,
  LIVE,
  PAYMENT_FIELD_MAP,
  Payment,
  SUBSCRIPTION_FIELD_MAP,
  SalonBilling,
  Subscription,
  cycleInfo,
  subStatus,
} from '../../subscriptions/billing.model';
import { BillingRequest } from '../../subscriptions/components/billing-dialogs/billing-dialogs.component';
import { PaymentAction, PaymentRowComponent } from '../../subscriptions/components/payment-row/payment-row.component';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { t } from '../../../../core/i18n/i18n';

/** Salon page tab: the running subscription, how it changed, and every payment. */
@Component({
  selector: 'app-salon-billing',
  standalone: true,
  imports: [TPipe, PanelComponent, FactsComponent, ButtonComponent, MenuComponent, MenuItemComponent, LedgerComponent, EmptyStateComponent, PaymentRowComponent],
  template: `
    <div class="grid">
      <app-panel heading="Subscription" [meta]="sub() ? status().label : ''">
        @if (sub(); as s) {
          @if (live()) {
            <span panelAction class="actions">
              @if (s.status === 'trialing') {
                <button appButton size="sm" variant="primary" type="button" (click)="change(s, 'trial_converted')">{{ 'Convert to paid' | t }}</button>
              }
              @if (s.status === 'paused' || s.status === 'past_due') {
                <button appButton size="sm" type="button" (click)="change(s, 'resume')">{{ 'Resume' | t }}</button>
              }
              <app-menu ariaLabel="Change the subscription">
                @for (a of actions(); track a) {
                  <button appMenuItem type="button" [tone]="a === 'cancel' ? 'danger' : 'default'" (click)="change(s, a)">{{ actionLabel(a) }}…</button>
                }
              </app-menu>
            </span>
          } @else {
            <button panelAction appButton size="sm" variant="primary" type="button" (click)="startNew()">{{ 'Start a new one' | t }}</button>
          }
          <app-facts [items]="facts()" />
          @if (s.notes) {
            <p class="notes">{{ s.notes }}</p>
          }
        } @else {
          <app-empty-state
            heading="No subscription yet"
            text="Start one with the plan and promotion (Early Bird: 3 free months for the first 50 salons)."
          >
            <button appButton variant="primary" type="button" (click)="startNew()">{{ 'Start subscription' | t }}</button>
          </app-empty-state>
        }
      </app-panel>

      @if (billing()?.changes?.length) {
        <app-panel heading="Changes">
          <ol class="history">
            @for (c of billing()!.changes; track c.id) {
              <li>
                <span class="when">{{ date(c.changedOn) }}</span>
                <span>
                  <strong>{{ changeLabel(c.kind) }}</strong>
                  @if (c.kind === 'upgrade' || c.kind === 'downgrade') {
                    {{ c.fromPlanName }} → {{ c.toPlanName }}
                  }
                  @if (c.fromPriceBani !== null && c.fromPriceBani !== c.toPriceBani) {
                    · {{ money(c.fromPriceBani / 100) }} → {{ money((c.toPriceBani ?? 0) / 100) }}
                  } @else if (c.kind === 'start') {
                    · {{ money((c.toPriceBani ?? 0) / 100) }}
                  }
                  @if (c.note) {
                    <span class="muted"> · {{ c.note }}</span>
                  }
                  @if (c.changedByName) {
                    <span class="muted"> · {{ c.changedByName }}</span>
                  }
                </span>
              </li>
            }
          </ol>
        </app-panel>
      }
    </div>

    <app-panel class="payments" heading="Payments" [meta]="payments().length + ''" [flush]="payments().length > 0">
      <button panelAction appButton variant="ghost" size="sm" type="button" (click)="addPayment()">{{ 'Add payment' | t }}</button>
      @if (payments().length) {
        <app-ledger [headers]="['For', 'Amount', 'Due', 'Status', '']" [numeric]="[1]" columns="minmax(0, 1.8fr) 110px 130px 100px auto">
          @for (p of payments(); track p.id) {
            <app-payment-row [payment]="p" [showSalon]="false" (act)="onPayment(p, $event)" />
          }
        </app-ledger>
      } @else {
        <p class="muted small">
          {{ 'No payments yet. Monthly ones are created from Subscriptions › Create payments; add extra work (100 RON/h) or a one-off here.' | t }}
        </p>
      }
    </app-panel>
  `,
  styles: `
    :host { display: grid; gap: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr)); gap: 16px; align-items: start; }
    .actions { display: inline-flex; gap: 6px; align-items: center; }
    .notes { white-space: pre-line; font-size: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
    .history { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; font-size: 14px; }
    .history li { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 12px; }
    .when { color: var(--muted); font-variant-numeric: tabular-nums; }
    .payments ::ng-deep p.small { padding: 16px 18px; }
    @media (max-width: 560px) { .history li { grid-template-columns: 1fr; gap: 0; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalonBillingComponent {
  readonly billing = input<SalonBilling | null>(null);
  readonly salonId = input.required<string>();
  readonly salonPlanId = input('');
  readonly request = output<BillingRequest>();

  protected readonly sub = computed<Subscription | null>(() => {
    const row = this.billing()?.subscription;
    return row ? fromApi<Subscription>(SUBSCRIPTION_FIELD_MAP, row) : null;
  });
  protected readonly live = computed(() => !!this.sub() && LIVE.includes(this.sub()!.status));
  protected readonly status = computed(() => subStatus(this.sub()?.status ?? 'active'));
  protected readonly actions = computed(() => (this.sub() ? CHANGES_FOR[this.sub()!.status] : []));
  protected readonly payments = computed<Payment[]>(() => (this.billing()?.payments ?? []).map((r) => fromApi<Payment>(PAYMENT_FIELD_MAP, r)));

  protected readonly facts = computed<Fact[]>(() => {
    const s = this.sub();
    if (!s) return [];
    const cycle = cycleInfo(s.billingCycle);
    const facts: Fact[] = [
      { label: 'Status', value: t(this.status().label), tone: this.status().tone },
      { label: 'Plan', value: s.planName },
      { label: 'Price', value: `${formatRon(s.price)} ${t(cycle.per)}` },
      { label: 'Counts toward MRR', value: t('{amount} / month', { amount: formatRon(s.mrr) }) },
      { label: 'Promotion', value: s.promotionName },
      { label: 'Started', value: formatDate(s.startedOn) },
      { label: 'Free until', value: formatDate(s.trialEndsOn), hint: s.trialEndsOn ? 'last free day' : '' },
      { label: 'Minimum term until', value: formatDate(s.minTermEndsOn) },
    ];
    if (!this.live()) facts.push({ label: 'Ended', value: formatDate(s.canceledOn), hint: s.cancelReason });
    return facts;
  });

  protected readonly date = (iso: string) => formatDate(iso);
  protected readonly money = formatRon;
  protected readonly changeLabel = (k: string) => t(CHANGE_LABELS[k as ChangeKind] ?? k);
  protected readonly actionLabel = (k: ChangeKind) => t(CHANGE_ACTIONS[k]);

  protected change(sub: Subscription, change: ChangeKind): void {
    this.request.emit({ kind: 'change', sub, change });
  }

  protected startNew(): void {
    this.request.emit({ kind: 'start', salonId: this.salonId(), planId: this.salonPlanId() });
  }

  protected addPayment(): void {
    const s = this.sub();
    this.request.emit({ kind: 'payment', salonId: this.salonId(), subscriptionId: s && this.live() ? s.id : undefined });
  }

  protected onPayment(p: Payment, action: PaymentAction): void {
    if (action === 'paid') this.request.emit({ kind: 'paid', payment: p });
    else if (action === 'reopen') this.request.emit({ kind: 'reopen', payment: p });
    else if (action === 'delete') this.request.emit({ kind: 'delete-payment', payment: p });
    else this.request.emit({ kind: 'waive', payment: p });
  }
}
