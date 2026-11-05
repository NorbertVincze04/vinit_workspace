import { ChangeDetectionStrategy, Component } from '@angular/core';
import { COMPANY_FACTS, TEAM, TECH_STACK } from '../../../../core/data/business.data';
import {
  BadgeComponent,
  CardComponent,
  CheckListComponent,
  FactListComponent,
  GridComponent,
  SectionComponent,
} from '../../../../shared/ui';

/** Company fact sheet, team roles and tech stack. Anchor: #company */
@Component({
  selector: 'app-company-section',
  standalone: true,
  imports: [SectionComponent, GridComponent, CardComponent, BadgeComponent, CheckListComponent, FactListComponent],
  template: `
    <app-section id="company" eyebrow="Business plan · 1.1 & 4" title="Company & team">
      <app-grid min="340px">
        <app-card padding="lg">
          <h3 class="eyebrow">Fact sheet</h3>
          <app-fact-list [items]="facts" />
        </app-card>
        <div class="stack">
          @for (role of team; track role.title) {
            <app-card>
              <div class="head">
                <h3 class="title-sm">{{ role.title }}</h3>
                <app-badge variant="outline">{{ role.type }}</app-badge>
              </div>
              <app-check-list [items]="role.duties" />
              <p class="muted small">{{ role.reward }}</p>
            </app-card>
          }
          <app-card tone="soft">
            <h3 class="eyebrow">Tech stack</h3>
            <div class="cluster">
              @for (tech of stack; track tech) {
                <app-badge variant="second">{{ tech }}</app-badge>
              }
            </div>
          </app-card>
        </div>
      </app-grid>
    </app-section>
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
    h3.eyebrow { font-weight: 500; line-height: 1.5; }
    .cluster { --cluster-gap: 8px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanySectionComponent {
  protected readonly facts = COMPANY_FACTS;
  protected readonly team = TEAM;
  protected readonly stack = TECH_STACK;
}
