import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  FINANCE_FIGURES,
  FUNDING_SOURCES,
  INVESTMENT_TABLE,
  MONTHLY_COSTS,
} from '../../../../core/data/business.data';
import {
  CardComponent,
  CheckListComponent,
  DataTableComponent,
  FactListComponent,
  GridComponent,
  SectionComponent,
  StatComponent,
} from '../../../../shared/ui';

/** Investment, monthly costs, break-even and funding. Anchor: #finances */
@Component({
  selector: 'app-finances-section',
  standalone: true,
  imports: [
    SectionComponent,
    GridComponent,
    CardComponent,
    StatComponent,
    DataTableComponent,
    FactListComponent,
    CheckListComponent,
  ],
  template: `
    <app-section id="finances" tone="alt" eyebrow="Business plan · 5" title="Finances">
      <app-grid min="190px" align="stretch">
        @for (figure of figures; track figure.label) {
          <app-card>
            <app-stat [label]="figure.label" [value]="figure.value" [hint]="figure.hint" />
          </app-card>
        }
      </app-grid>
      <app-grid min="320px">
        <div class="stack">
          <h3 class="eyebrow">Initial investment</h3>
          <app-data-table [table]="investment" caption="Initial investment breakdown" />
        </div>
        <div class="stack">
          <app-card>
            <h3 class="eyebrow">Monthly costs</h3>
            <app-fact-list [items]="monthly" />
          </app-card>
          <app-card>
            <h3 class="eyebrow">Funding</h3>
            <app-check-list [items]="funding" icon="arrow-right" />
          </app-card>
        </div>
      </app-grid>
    </app-section>
  `,
  styles: `
    app-card { height: 100%; }
    .stack { --stack-gap: 12px; }
    h3.eyebrow { font-weight: 500; line-height: 1.5; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancesSectionComponent {
  protected readonly figures = FINANCE_FIGURES;
  protected readonly investment = INVESTMENT_TABLE;
  protected readonly monthly = MONTHLY_COSTS;
  protected readonly funding = FUNDING_SOURCES;
}
