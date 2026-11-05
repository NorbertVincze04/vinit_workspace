import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BREAK_EVEN_SALONS, FINANCE } from '../../../../core/data/finance.data';
import { PHASES } from '../../../../core/data/phases.data';
import { PlanCalendarService } from '../../../../core/services/plan-calendar.service';
import { formatRon, percent } from '../../../../core/utils/format';
import { KpiCardComponent } from '../../../../shared/components';
import { GridComponent, SectionComponent, StatTone } from '../../../../shared/ui';
import { ClientsStore } from '../../../tools/clients/clients.store';
import { FinancesStore } from '../../../tools/finances/finances.store';
import { MarketingStore } from '../../../tools/marketing/marketing.store';
import { RoadmapStore } from '../../../tools/roadmap/roadmap.store';
import { TasksStore } from '../../../tools/tasks/tasks.store';

interface Kpi {
  label: string;
  value: string;
  hint: string;
  percent: number | null;
  tone: StatTone;
  route: string;
  linkLabel: string;
}

const kpi = (k: Partial<Kpi> & Pick<Kpi, 'label' | 'value'>): Kpi => ({
  hint: '',
  percent: null,
  tone: 'default',
  route: '',
  linkLabel: '',
  ...k,
});

/** Live statistics read from every tool's store. Anchor: #status */
@Component({
  selector: 'app-status-section',
  standalone: true,
  imports: [SectionComponent, GridComponent, KpiCardComponent],
  template: `
    <app-section
      id="status"
      tone="alt"
      eyebrow="Live"
      title="Current status"
      lede="Figures read from the workspace tools. Update clients, finances, tasks and the content plan in their tools; this page follows.">
      <app-grid min="210px" align="stretch">
        @for (k of kpis(); track k.label) {
          <app-kpi-card
            [label]="k.label"
            [value]="k.value"
            [hint]="k.hint"
            [tone]="k.tone"
            [percent]="k.percent"
            [route]="k.route"
            [linkLabel]="k.linkLabel"
          />
        }
      </app-grid>
    </app-section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusSectionComponent {
  private readonly plan = inject(PlanCalendarService);
  private readonly roadmap = inject(RoadmapStore);
  private readonly tasks = inject(TasksStore);
  private readonly clients = inject(ClientsStore);
  private readonly finances = inject(FinancesStore);
  private readonly marketing = inject(MarketingStore);

  private readonly timeline = computed<Kpi>(() => {
    const month = this.plan.currentMonth();
    const start = this.plan.monthLabel(1);
    const base = { label: 'Plan timeline', route: '/tools/tasks', linkLabel: 'Change start month' };
    if (month < 1) return kpi({ ...base, value: 'Not started', hint: `Month 1 = ${start}`, percent: 0 });
    if (month > 12) return kpi({ ...base, value: 'Year 1 done', hint: `Started ${start}`, percent: 100 });
    const phase = PHASES.find((p) => month >= p.months[0] && month <= p.months[1]);
    return kpi({ ...base, value: `Month ${month} / 12`, hint: `${phase?.name ?? ''} phase · started ${start}`, percent: percent(month, 12) });
  });

  private readonly activeClients = computed<Kpi>(() => {
    const n = this.clients.active().length;
    const goal = FINANCE.year1Salons;
    let hint = 'Year 1 goal reached';
    if (n < BREAK_EVEN_SALONS) hint = `${BREAK_EVEN_SALONS - n} more to break-even (${BREAK_EVEN_SALONS})`;
    else if (n < goal) hint = `Break-even reached · ${goal - n} to goal`;
    return kpi({ label: 'Active clients', value: `${n} / ${goal}`, hint, percent: percent(n, goal), route: '/tools/clients', linkLabel: 'Open clients' });
  });

  private readonly mrr = computed<Kpi>(() => {
    const mrr = this.clients.mrr();
    return kpi({
      label: 'MRR',
      value: formatRon(mrr),
      hint: `${this.clients.breakEvenPercent()}% of ${formatRon(FINANCE.monthlyCosts)} monthly costs`,
      percent: this.clients.breakEvenPercent(),
    });
  });

  private readonly businessResult = computed<Kpi>(() => {
    const b = this.finances.businessThisMonth();
    return kpi({
      label: 'VINIT result this month',
      value: formatRon(b.result, true),
      hint: `${formatRon(b.income)} in − ${formatRon(b.expense)} out`,
      tone: b.result > 0 ? 'positive' : b.result < 0 ? 'negative' : 'default',
      route: '/tools/finances',
      linkLabel: 'Open finances',
    });
  });

  private readonly roadmapProgress = computed<Kpi>(() => {
    const o = this.roadmap.overall();
    const current = this.roadmap.phases().find((p) => p.current);
    return kpi({
      label: 'Roadmap steps',
      value: `${o.done} / ${o.total}`,
      hint: current ? `Current phase: ${current.phase.name}` : 'All phases complete',
      percent: o.percent,
      route: '/tools/roadmap',
      linkLabel: 'Open roadmap',
    });
  });

  private readonly taskProgress = computed<Kpi>(() => {
    const o = this.tasks.overall();
    const overdue = this.tasks.overdueCount();
    return kpi({
      label: 'Tasks done',
      value: `${o.done} / ${o.total}`,
      hint: overdue ? `${overdue} overdue` : 'Nothing overdue',
      percent: o.percent,
      route: '/tools/tasks',
      linkLabel: 'Open tasks',
    });
  });

  private readonly content = computed<Kpi>(() => {
    const t = this.marketing.totals();
    return kpi({
      label: 'Content published',
      value: `${t.published} / ${t.planned}`,
      hint: `${t.appearances} appearances planned so far`,
      percent: percent(t.published, t.planned),
      route: '/tools/marketing',
      linkLabel: 'Open marketing plan',
    });
  });

  protected readonly kpis = computed(() => [
    this.timeline(),
    this.activeClients(),
    this.mrr(),
    this.businessResult(),
    this.roadmapProgress(),
    this.taskProgress(),
    this.content(),
  ]);
}
