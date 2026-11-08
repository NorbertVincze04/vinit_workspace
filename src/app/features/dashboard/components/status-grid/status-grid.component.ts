import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { formatRon, percent } from '../../../../core/utils/format';
import { KpiCardComponent } from '../../../../shared/components';
import { StatTone } from '../../../../shared/ui';
import { FinancesStore } from '../../../tools/finances/finances.store';
import { MarketingStore } from '../../../tools/marketing/marketing.store';
import { RoadmapStore } from '../../../tools/roadmap/roadmap.store';
import { SalonsStore } from '../../../tools/salons/salons.store';
import { BillingStore } from '../../../tools/subscriptions/billing.store';
import { TasksStore } from '../../../tools/tasks/tasks.store';
import { t } from '../../../../core/i18n/i18n';

interface Kpi {
  label: string;
  value: string;
  hint: string;
  percent: number | null;
  tone: StatTone;
  route: string;
}

const kpi = (k: Partial<Kpi> & Pick<Kpi, 'label' | 'value' | 'route'>): Kpi => ({
  hint: '',
  percent: null,
  tone: 'default',
  ...k,
});

/** Live figures read from every tool's store; each tile links to its tool. */
@Component({
  selector: 'app-status-grid',
  standalone: true,
  imports: [KpiCardComponent],
  template: `
    @for (k of kpis(); track k.label) {
      <app-kpi-card
        [label]="k.label"
        [value]="k.value"
        [hint]="k.hint"
        [tone]="k.tone"
        [percent]="k.percent"
        [route]="k.route"
      />
    }
  `,
  styles: `
    :host { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)); gap: 12px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusGridComponent {
  private readonly roadmap = inject(RoadmapStore);
  private readonly tasks = inject(TasksStore);
  private readonly salons = inject(SalonsStore);
  private readonly billing = inject(BillingStore);
  private readonly finances = inject(FinancesStore);
  private readonly marketing = inject(MarketingStore);

  protected readonly kpis = computed<Kpi[]>(() => {
    const active = this.salons.active().length;
    const mrr = this.billing.mrr();
    const goals = this.roadmap.goals();
    const year = this.roadmap.currentYear();
    const monthlyCosts = Math.round((goals.monthlyCostsBani ?? 0) / 100);
    const breakEven = goals.breakEvenSalons ?? 0;
    const costsPercent = percent(mrr, monthlyCosts);
    const goal = goals.payingSalons ?? 0;
    const business = this.finances.businessThisMonth();
    const tasks = this.tasks.overall();
    const overdue = this.tasks.overdueCount();
    const roadmap = this.roadmap.overall();
    const phase = this.roadmap.phases().find((p) => p.current);
    const content = this.marketing.totals();

    return [
      kpi({
        label: 'Active salons',
        value: `${active} / ${goal}`,
        hint:
          active < breakEven
            ? t('{n} more to break-even', { n: breakEven - active })
            : active < goal
              ? t('Break-even reached · {n} to goal', { n: goal - active })
              : t('Year {year} goal reached', { year }),
        percent: percent(active, goal),
        route: '/tools/salons',
      }),
      kpi({
        label: 'Monthly recurring revenue',
        value: formatRon(mrr),
        hint: t('{pct}% of {costs} costs', { pct: costsPercent, costs: formatRon(monthlyCosts) }),
        percent: costsPercent,
        route: '/tools/subscriptions',
      }),
      kpi({
        label: 'Business result this month',
        value: formatRon(business.result, true),
        hint: t('{income} in · {expense} out', { income: formatRon(business.income), expense: formatRon(business.expense) }),
        tone: business.result > 0 ? 'positive' : business.result < 0 ? 'negative' : 'default',
        route: '/tools/finances',
      }),
      kpi({
        label: 'Tasks done',
        value: `${tasks.done} / ${tasks.total}`,
        hint: overdue ? t('{n} overdue', { n: overdue }) : t('Nothing overdue'),
        tone: overdue ? 'negative' : 'default',
        percent: tasks.percent,
        route: '/tools/tasks',
      }),
      kpi({
        label: 'Content published',
        value: `${content.published} / ${content.planned}`,
        hint: t('{n} appearances planned', { n: content.appearances }),
        percent: percent(content.published, content.planned),
        route: '/tools/marketing',
      }),
      kpi({
        label: t('Year {year} roadmap', { year }),
        value: `${roadmap.done} / ${roadmap.total}`,
        hint: phase ? t('Current phase: {phase}', { phase: t(phase.phase.name) }) : t('All phases complete'),
        percent: roadmap.percent,
        route: '/tools/roadmap',
      }),
    ];
  });
}
