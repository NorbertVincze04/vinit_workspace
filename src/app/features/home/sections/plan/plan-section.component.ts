import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GOAL_GROUPS, KEY_DEADLINES, QUARTER_PLAN } from '../../../../core/data/business.data';
import {
  BadgeComponent,
  CardComponent,
  DataTableComponent,
  FactListComponent,
  GridComponent,
  SectionComponent,
} from '../../../../shared/ui';

/** SMART goals, quarterly activity plan and key deadlines. Anchor: #plan */
@Component({
  selector: 'app-plan-section',
  standalone: true,
  imports: [SectionComponent, GridComponent, CardComponent, BadgeComponent, DataTableComponent, FactListComponent],
  template: `
    <app-section id="plan" eyebrow="Business plan · 1.2 & 3.3" title="Goals & Year 1 plan">
      @for (group of groups; track group.label; let first = $first) {
        <div class="group">
          <h3 class="eyebrow">{{ group.label }} objectives</h3>
          <app-grid min="250px" align="stretch">
            @for (goal of group.goals; track goal.title) {
              <app-card [tone]="first ? 'default' : 'soft'">
                <app-badge [variant]="first ? 'soft' : 'second'">{{ goal.tag }}</app-badge>
                <h4 class="title-sm">{{ goal.title }}</h4>
                <p class="muted small">{{ goal.text }}</p>
              </app-card>
            }
          </app-grid>
        </div>
      }
      <div class="group">
        <h3 class="eyebrow">Activities by quarter</h3>
        <app-data-table [table]="quarters" caption="Year 1 activities by quarter" style="--table-min: 640px" />
      </div>
      <app-card>
        <h3 class="eyebrow">Key deadlines</h3>
        <app-fact-list [items]="deadlines" />
      </app-card>
    </app-section>
  `,
  styles: `
    .group { display: grid; gap: 12px; }
    h3.eyebrow { font-weight: 500; line-height: 1.5; }
    app-card { height: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanSectionComponent {
  protected readonly groups = GOAL_GROUPS;
  protected readonly quarters = QUARTER_PLAN;
  protected readonly deadlines = KEY_DEADLINES;
}
