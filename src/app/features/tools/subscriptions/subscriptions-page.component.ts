import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { monthName, shiftMonth, todayISO } from '../../../core/utils/date';
import { formatRon, percent } from '../../../core/utils/format';
import { BarChartComponent, ChartGroup, ChartSeries } from '../../../shared/components';
import { RonPipe } from '../../../shared/pipes/ron.pipe';
import {
  ButtonComponent,
  CardComponent,
  ChipGroupComponent,
  ChipOption,
  EmptyStateComponent,
  IconComponent,
  LedgerComponent,
  MenuComponent,
  MenuItemComponent,
  MeterComponent,
  PageHeaderComponent,
  PanelComponent,
  StatComponent,
  TabsComponent,
} from '../../../shared/ui';
import { PlansStore } from '../salons/plans.store';
import { RoadmapStore } from '../roadmap/roadmap.store';
import { BillingDialogsComponent, BillingRequest } from './components/billing-dialogs/billing-dialogs.component';
import { BillingWarningsComponent } from './components/billing-warnings/billing-warnings.component';
import { PaymentAction, PaymentRowComponent } from './components/payment-row/payment-row.component';
import { SubscriptionRowComponent } from './components/subscription-row/subscription-row.component';
import { ChangeKind, LIVE, Payment, Subscription } from './billing.model';
import { BillingStore } from './billing.store';
import { TPipe } from '../../../core/i18n/t.pipe';
import { countOf, t } from '../../../core/i18n/i18n';

/** Subscriptions tool: MRR, who pays what, payments to collect and billing warnings. */
@Component({
  selector: 'app-subscriptions-page',
  standalone: true,
  imports: [TPipe, 
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    MenuComponent,
    MenuItemComponent,
    CardComponent,
    StatComponent,
    MeterComponent,
    PanelComponent,
    TabsComponent,
    ChipGroupComponent,
    LedgerComponent,
    EmptyStateComponent,
    BarChartComponent,
    RonPipe,
    BillingDialogsComponent,
    BillingWarningsComponent,
    PaymentRowComponent,
    SubscriptionRowComponent,
  ],
  templateUrl: './subscriptions-page.component.html',
  styleUrl: './subscriptions-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionsPageComponent {
  protected readonly store = inject(BillingStore);
  protected readonly plans = inject(PlansStore);
  private readonly toast = inject(ToastService);

  protected readonly tab = signal('subscriptions');
  protected readonly subFilter = signal('live');
  protected readonly payFilter = signal('open');
  protected readonly request = signal<BillingRequest | null>(null);

  private readonly plan = inject(RoadmapStore);
  /** This year's goals (Roadmap), in RON. */
  protected readonly costs = computed(() => Math.round((this.plan.goals().monthlyCostsBani ?? 0) / 100));
  protected readonly goal = computed(() => Math.round((this.plan.goals().mrrBani ?? 0) / 100));
  protected readonly costsPercent = computed(() => percent(this.store.mrr(), this.costs()));
  protected readonly format = formatRon;

  protected readonly thisMonth = todayISO().slice(0, 7);
  protected readonly nextMonth = shiftMonth(this.thisMonth, 1);
  protected readonly monthName = monthName;

  protected readonly tabs = computed<ChipOption[]>(() => [
    { value: 'subscriptions', label: 'Subscriptions', count: this.store.live().length },
    { value: 'payments', label: 'Payments', count: this.store.payments().filter((p) => p.status === 'due').length },
    { value: 'mrr', label: 'MRR history' },
  ]);

  protected readonly subChips = computed<ChipOption[]>(() => {
    const all = this.store.subscriptions();
    const n = (f: (s: Subscription) => boolean) => all.filter(f).length;
    return [
      { value: 'live', label: 'Running', count: n((s) => LIVE.includes(s.status)) },
      { value: 'trialing', label: 'Trial', count: n((s) => s.status === 'trialing') },
      { value: 'paying', label: 'Paying', count: n((s) => s.status === 'active' || s.status === 'past_due') },
      { value: 'ended', label: 'Ended', count: n((s) => !LIVE.includes(s.status)) },
    ];
  });

  protected readonly visibleSubs = computed(() => {
    const f = this.subFilter();
    return this.store.subscriptions().filter((s) =>
      f === 'live'
        ? LIVE.includes(s.status)
        : f === 'trialing'
          ? s.status === 'trialing'
          : f === 'paying'
            ? s.status === 'active' || s.status === 'past_due'
            : !LIVE.includes(s.status),
    );
  });

  protected readonly payChips = computed<ChipOption[]>(() => {
    const all = this.store.payments();
    return [
      { value: 'open', label: 'To collect', count: all.filter((p) => p.status === 'due').length },
      { value: 'overdue', label: 'Overdue', count: this.store.overdue().length },
      { value: 'paid', label: 'Paid', count: all.filter((p) => p.status === 'paid').length },
      { value: 'all', label: 'All', count: all.length },
    ];
  });

  protected readonly visiblePayments = computed(() => {
    const f = this.payFilter();
    const list = this.store.payments().filter((p) =>
      f === 'open' ? p.status === 'due' : f === 'overdue' ? p.overdue : f === 'paid' ? p.status === 'paid' : true,
    );
    // Money to collect: oldest first. History: newest first.
    return f === 'open' || f === 'overdue' ? [...list].sort((a, b) => a.dueOn.localeCompare(b.dueOn)) : list;
  });

  protected readonly series: ChartSeries[] = [{ key: 'mrr', label: 'MRR', color: 'var(--chart-1)' }];
  protected readonly mrrGroups = computed<ChartGroup[]>(() =>
    this.store.mrrHistory().map((m) => ({
      key: m.month,
      label: monthName(m.month, true),
      title: monthName(m.month),
      values: { mrr: m.mrrBani / 100 },
      selected: m.month === this.thisMonth,
      extra: [{ label: 'Paying salons', value: String(m.paying) }],
    })),
  );

  constructor() {
    // Payments turn overdue as days pass: start from fresh figures.
    if (this.store.loaded()) void this.store.refresh();
  }

  protected onChange(sub: Subscription, change: ChangeKind): void {
    this.request.set({ kind: 'change', sub, change });
  }

  protected onPayment(p: Payment, action: PaymentAction): void {
    const kind = action === 'delete' ? 'delete-payment' : action;
    this.request.set({ kind, payment: p });
  }

  protected async generate(month: string): Promise<void> {
    try {
      const n = await this.store.generate(month);
      this.toast.show(n ? t('{payments} added for {month}', { payments: countOf(n, 'payment', 'payments'), month: monthName(month) }) : t('Nothing new: {month} is already generated', { month: monthName(month) }), 5000);
      this.tab.set('payments');
      this.payFilter.set('open');
    } catch {
      /* toast shown */
    }
  }
}
