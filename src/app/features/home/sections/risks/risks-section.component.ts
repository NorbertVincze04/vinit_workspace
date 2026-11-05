import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PLAN_B, RISKS } from '../../../../core/data/business.data';
import { BadgeComponent, CardComponent, FactListComponent, GridComponent, SectionComponent } from '../../../../shared/ui';

/** Risks with their responses, and the alternative course (Plan B). Anchor: #risks */
@Component({
  selector: 'app-risks-section',
  standalone: true,
  imports: [SectionComponent, GridComponent, CardComponent, BadgeComponent, FactListComponent],
  template: `
    <app-section id="risks" eyebrow="Business plan · 3.4" title="Risks & Plan B">
      <app-grid min="260px" align="stretch">
        @for (risk of risks; track risk.title) {
          <app-card>
            <h3 class="title-sm">{{ risk.title }}</h3>
            <app-fact-list
              style="--fact-label-width: 80px"
              [items]="[
                { label: 'Risk', value: risk.problem },
                { label: 'Response', value: risk.response }
              ]"
            />
          </app-card>
        }
      </app-grid>
      <app-card highlight>
        <app-badge variant="solid">Plan B</app-badge>
        <p>{{ planB }}</p>
      </app-card>
    </app-section>
  `,
  styles: 'app-card { height: 100%; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RisksSectionComponent {
  protected readonly risks = RISKS;
  protected readonly planB = PLAN_B;
}
