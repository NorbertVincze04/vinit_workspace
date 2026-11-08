import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PHASES } from '../../core/data/phases.data';
import { TOOL_GROUPS } from '../../core/data/tools.data';
import { PlanCalendarService } from '../../core/services/plan-calendar.service';
import { PageHeaderComponent } from '../../shared/ui';
import { DuePaymentsComponent } from './components/due-payments/due-payments.component';
import { LocalDataBannerComponent } from './components/local-data-banner/local-data-banner.component';
import { SalonAlertsComponent } from './components/salon-alerts/salon-alerts.component';
import { RecentActivityComponent } from './components/recent-activity/recent-activity.component';
import { LegacyClientsBannerComponent } from '../tools/salons/components/legacy-clients-banner/legacy-clients-banner.component';
import { DueTasksComponent } from './components/due-tasks/due-tasks.component';
import { StatusGridComponent } from './components/status-grid/status-grid.component';
import { ToolTileComponent } from './components/tool-tile/tool-tile.component';
import { locale, t } from '../../core/i18n/i18n';
import { TPipe } from '../../core/i18n/t.pipe';

/** Workspace home: today's context, tool launcher, live figures and what needs attention. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TPipe, 
    PageHeaderComponent,
    LocalDataBannerComponent,
    LegacyClientsBannerComponent,
    SalonAlertsComponent,
    RecentActivityComponent,
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
  protected readonly groups = TOOL_GROUPS;

  protected readonly today = new Date().toLocaleDateString(locale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  /** "Plan month 3 of 12 · Build phase" (or before / after Year 1). */
  protected readonly planStatus = computed(() => {
    const month = this.plan.currentMonth();
    if (month < 1) return t('Year 1 starts {month}', { month: this.plan.monthLabel(1) });
    if (month > 12) return t('Year 1 complete');
    const phase = PHASES.find((p) => month >= p.months[0] && month <= p.months[1]);
    return t('Plan month {month} of 12', { month }) + (phase ? ' · ' + t('{phase} phase', { phase: t(phase.name) }) : '');
  });
}
