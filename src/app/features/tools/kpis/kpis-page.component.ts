import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { monthName, todayISO } from '../../../core/utils/date';
import { formatRon, percent } from '../../../core/utils/format';
import { BarChartComponent, ChartGroup, ChartSeries, KpiCardComponent } from '../../../shared/components';
import {
  ButtonComponent,
  EmptyStateComponent,
  LedgerComponent,
  LedgerRowComponent,
  MenuComponent,
  MenuItemComponent,
  MonthSwitcherComponent,
  PageHeaderComponent,
  PanelComponent,
  StatTone,
} from '../../../shared/ui';
import { LEAD_STAGES } from '../leads/leads.model';
import { pctText } from './kpis.model';
import { KpisStore } from './kpis.store';

interface Card {
  label: string;
  value: string;
  hint: string;
  tone: StatTone;
  percent: number | null;
  route: string;
}

/** KPI dashboard: the month against the business plan's targets, and the trend over 12 months. */
@Component({
  selector: 'app-kpis-page',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    MonthSwitcherComponent,
    MenuComponent,
    MenuItemComponent,
    ButtonComponent,
    KpiCardComponent,
    PanelComponent,
    BarChartComponent,
    LedgerComponent,
    LedgerRowComponent,
    EmptyStateComponent,
  ],
  templateUrl: './kpis-page.component.html',
  styles: `
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(230px, 100%), 1fr)); gap: 12px; }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr)); gap: 16px; }
    .note { font-size: 13px; color: var(--muted); margin: 10px 0 0; }
    .pipeline { display: flex; flex-wrap: wrap; gap: 8px 24px; font-size: 14px; }
    .pipeline strong { font-variant-numeric: tabular-nums; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpisPageComponent {
  protected readonly store = inject(KpisStore);
  protected readonly month = signal(todayISO().slice(0, 7));
  protected readonly isCurrent = computed(() => this.month() === todayISO().slice(0, 7));
  protected readonly monthName = monthName;
  protected readonly pct = pctText;
  protected readonly ron = (bani: number) => formatRon(bani / 100);

  protected readonly cards = computed<Card[]>(() => {
    const k = this.store.current();
    const t = this.store.targets();
    if (!k || !t) return [];
    const mrr = k.mrrBani;
    const ret = k.retentionPct;
    const onboarding = k.avgOnboardingHours;
    return [
      {
        label: 'Paying salons',
        value: `${k.paying} / ${t.year1Salons}`,
        hint: k.paying < t.breakEvenSalons ? `${t.breakEvenSalons - k.paying} more to break-even (${t.breakEvenSalons})` : 'Break-even reached',
        tone: 'default',
        percent: percent(k.paying, t.year1Salons),
        route: '/tools/subscriptions',
      },
      {
        label: 'MRR',
        value: this.ron(mrr),
        hint: `goal ${this.ron(t.year1MrrBani)} · costs ${this.ron(t.monthlyCostsBani)}`,
        tone: mrr >= t.monthlyCostsBani ? 'positive' : 'default',
        percent: percent(mrr, t.year1MrrBani),
        route: '/tools/subscriptions',
      },
      {
        label: 'Retention this month',
        value: pctText(ret),
        hint: ret === null ? 'No paying salons at the start of the month' : `of ${k.payingAtStart} paying at the start · target ≥ ${t.retentionPct}%`,
        tone: ret === null ? 'default' : ret >= t.retentionPct ? 'positive' : 'negative',
        percent: ret,
        route: '/tools/salons',
      },
      {
        label: 'Retention this year',
        value: pctText(k.retentionYtdPct),
        hint: k.retentionYtdPct === null ? 'Nobody paid on 1 January yet' : `since 1 January · target ≥ ${t.retentionPct}%`,
        tone: k.retentionYtdPct === null ? 'default' : k.retentionYtdPct >= t.retentionPct ? 'positive' : 'negative',
        percent: k.retentionYtdPct,
        route: '/tools/salons',
      },
      {
        label: 'Trial → paid',
        value: pctText(k.trialToPaidPct),
        hint: k.trialsEnded ? `${k.trialsConverted} of ${k.trialsEnded} trials that ended this month` : 'No trial ended this month',
        tone: 'default',
        percent: k.trialToPaidPct,
        route: '/tools/subscriptions',
      },
      {
        label: 'Onboarding time',
        value: onboarding === null ? '—' : `${onboarding}h`,
        hint: k.onboardingsLive
          ? `${k.onboardingsWithin48h} of ${k.onboardingsLive} live within ${t.onboardingHours}h`
          : 'No salon went live this month',
        tone: onboarding === null ? 'default' : onboarding <= t.onboardingHours ? 'positive' : 'negative',
        percent: null,
        route: '/tools/onboarding',
      },
      {
        label: 'New paying · churned',
        value: `+${k.newPaying} · −${k.churned}`,
        hint: 'salons this month',
        tone: k.churned > k.newPaying ? 'negative' : k.newPaying ? 'positive' : 'default',
        percent: null,
        route: '/tools/salons',
      },
      {
        label: 'Leads this month',
        value: `${k.leadsNew} new`,
        hint: `${k.leadsConverted} converted · ${k.leadsLost} lost`,
        tone: 'default',
        percent: null,
        route: '/tools/leads',
      },
    ];
  });

  protected readonly pipeline = computed(() => {
    const p = this.store.current()?.pipeline ?? {};
    return LEAD_STAGES.map((s) => ({ label: s.label, count: p[s.value] ?? 0 }));
  });

  protected readonly mrrSeries: ChartSeries[] = [{ key: 'mrr', label: 'MRR', color: 'var(--chart-1)' }];
  protected readonly salonSeries: ChartSeries[] = [
    { key: 'new', label: 'New paying', color: 'var(--chart-1)' },
    { key: 'churned', label: 'Churned', color: 'var(--chart-3)' },
  ];
  protected readonly mrrGroups = computed<ChartGroup[]>(() =>
    this.store.history().map((m) => ({
      key: m.month,
      label: monthName(m.month, true),
      title: monthName(m.month),
      values: { mrr: m.mrrBani / 100 },
      selected: m.month === this.month(),
      extra: [{ label: 'Paying salons', value: String(m.paying) }],
    })),
  );
  protected readonly salonGroups = computed<ChartGroup[]>(() =>
    this.store.history().map((m) => ({
      key: m.month,
      label: monthName(m.month, true),
      title: monthName(m.month),
      values: { new: m.newPaying, churned: m.churned },
      selected: m.month === this.month(),
      extra: [{ label: 'Retention', value: pctText(m.retentionPct) }],
    })),
  );
  protected readonly count = (n: number) => String(Math.round(n));
  protected readonly rows = computed(() => [...this.store.history()].reverse());

  constructor() {
    effect(
      () => {
        const m = this.month();
        untracked(() => void this.store.load(m));
      },
      { allowSignalWrites: true },
    );
  }
}
