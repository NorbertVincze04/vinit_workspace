import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MARKET_FIGURES, PERSONA, SEGMENTS } from '../../../../core/data/business.data';
import {
  CardComponent,
  FactListComponent,
  GridComponent,
  SectionComponent,
  StatComponent,
} from '../../../../shared/ui';
import { PersonaCardComponent } from '../../components/persona-card/persona-card.component';

/** Market size, target segments and the customer persona. Anchor: #market */
@Component({
  selector: 'app-market-section',
  standalone: true,
  imports: [SectionComponent, GridComponent, CardComponent, StatComponent, FactListComponent, PersonaCardComponent],
  template: `
    <app-section id="market" eyebrow="Business plan · 1.5 & 2.1" title="Market & customers">
      <app-grid min="180px" gap="lg">
        @for (figure of figures; track figure.label) {
          <app-stat tone="brand" [label]="figure.label" [value]="figure.value" [hint]="figure.hint" />
        }
      </app-grid>
      <app-grid min="320px" align="stretch">
        <app-card padding="lg">
          <h3 class="eyebrow">Target segments</h3>
          <app-fact-list [items]="segments" />
        </app-card>
        <app-persona-card [persona]="persona" />
      </app-grid>
    </app-section>
  `,
  styles: 'h3.eyebrow { font-weight: 500; line-height: 1.5; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketSectionComponent {
  protected readonly figures = MARKET_FIGURES;
  protected readonly segments = SEGMENTS;
  protected readonly persona = PERSONA;
}
