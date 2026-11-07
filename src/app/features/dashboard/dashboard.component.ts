import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PHASES } from '../../core/data/phases.data';
import { TOOLS } from '../../core/data/tools.data';
import { PlanCalendarService } from '../../core/services/plan-calendar.service';
import { PageHeaderComponent } from '../../shared/ui';
import { DuePaymentsComponent } from './components/due-payments/due-payments.component';
import { LocalDataBannerComponent } from './components/local-data-banner/local-data-banner.component';
import { SalonAlertsComponent } from './components/salon-alerts/salon-alerts.component';
import { LegacyClientsBannerComponent } from '../tools/salons/components/legacy-clients-banner/legacy-clients-banner.component';
import { DueTasksComponent } from './components/due-tasks/due-tasks.component';
import { StatusGridComponent } from './components/status-grid/status-grid.component';
import { ToolTileComponent } from './components/tool-tile/tool-tile.component';

/** Workspace home: today's context, tool launcher, live figures and what needs attention. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    PageHeaderComponent,
    LocalDataBannerComponent,
    LegacyClientsBannerComponent,
    SalonAlertsComponent,
    ToolTileComponent,
    StatusGridComponent,
    DueTasksComponent,
    DuePaymentsComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly plan = inject(PlanCalendarService);
  protected readonly tools = TOOLS;

  protected readonly today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  /** "Plan month 3 of 12 · Build phase" (or before / after Year 1). */
  protected readonly planStatus = computed(() => {
    const month = this.plan.currentMonth();
    if (month < 1) return `Year 1 starts ${this.plan.monthLabel(1)}`;
    if (month > 12) return 'Year 1 complete';
    const phase = PHASES.find((p) => month >= p.months[0] && month <= p.months[1]);
    return `Plan month ${month} of 12${phase ? ` · ${phase.name} phase` : ''}`;
  });
}
