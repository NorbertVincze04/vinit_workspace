import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BREAK_EVEN_SALONS, FINANCE } from '../../../../core/data/finance.data';
import { formatRon, percent } from '../../../../core/utils/format';
import { KpiCardComponent } from '../../../../shared/components';
import { StatTone } from '../../../../shared/ui';
import { FinancesStore } from '../../../tools/finances/finances.store';
import { MarketingStore } from '../../../tools/marketing/marketing.store';
import { RoadmapStore } from '../../../tools/roadmap/roadmap.store';
import { PlansStore } from '../../../tools/salons/plans.store';
import { SalonsStore } from '../../../tools/salons/salons.store';
import { TasksStore } from '../../../tools/tasks/tasks.store';

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
  private readonly plans = inject(PlansStore);

  /** Until subscriptions exist: the plan price of each active salon. */
  private readonly mrr = computed(() =>
    this.salons.active().reduce((sum, s) => sum + (this.plans.plan(s.planId)?.monthlyPrice ?? 0), 0),
  );
  private readonly finances = inject(FinancesStore);
  private readonly marketing = inject(MarketingStore);

  protected readonly kpis = computed<Kpi[]>(() => {
    const active = this.salons.active().length;
    const mrr = this.mrr();
    const costsPercent = percent(mrr, FINANCE.monthlyCosts);
    const goal = FINANCE.year1Salons;
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
          active < BREAK_EVEN_SALONS
            ? `${BREAK_EVEN_SALONS - active} more to break-even`
            : active < goal
              ? `Break-even reached · ${goal - active} to goal`
              : 'Year 1 goal reached',
        percent: percent(active, goal),
        route: '/tools/salons',
      }),
      kpi({
        label: 'Monthly recurring revenue',
        value: formatRon(mrr),
        hint: `${costsPercent}% of ${formatRon(FINANCE.monthlyCosts)} costs`,
        percent: costsPercent,
        route: '/tools/salons',
      }),
      kpi({
        label: 'Business result this month',
        value: formatRon(business.result, true),
        hint: `${formatRon(business.income)} in · ${formatRon(business.expense)} out`,
        tone: business.result > 0 ? 'positive' : business.result < 0 ? 'negative' : 'default',
        route: '/tools/finances',
      }),
      kpi({
        label: 'Tasks done',
        value: `${tasks.done} / ${tasks.total}`,
        hint: overdue ? `${overdue} overdue` : 'Nothing overdue',
        tone: overdue ? 'negative' : 'default',
        percent: tasks.percent,
        route: '/tools/tasks',
      }),
      kpi({
        label: 'Content published',
        value: `${content.published} / ${content.planned}`,
        hint: `${content.appearances} appearances planned`,
        percent: percent(content.published, content.planned),
        route: '/tools/marketing',
      }),
      kpi({
        label: 'Roadmap steps',
        value: `${roadmap.done} / ${roadmap.total}`,
        hint: phase ? `Current phase: ${phase.phase.name}` : 'All phases complete',
        percent: roadmap.percent,
        route: '/tools/roadmap',
      }),
    ];
  });
}
