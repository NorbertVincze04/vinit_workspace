import { ChangeDetectionStrategy, Component } from '@angular/core';
import { OFFER_RULES, PACKAGES_TABLE, POSITIONING, VALUE_POINTS } from '../../../../core/data/business.data';
import { FeatureTileComponent } from '../../../../shared/components';
import {
  CardComponent,
  CheckListComponent,
  DataTableComponent,
  GridComponent,
  SectionComponent,
} from '../../../../shared/ui';

/** Value proposition, packages and commercial rules. Anchor: #offer */
@Component({
  selector: 'app-offer-section',
  standalone: true,
  imports: [SectionComponent, GridComponent, CardComponent, CheckListComponent, DataTableComponent, FeatureTileComponent],
  template: `
    <app-section id="offer" tone="alt" eyebrow="Business plan · 1.3, 1.4 & 2.4" title="Product & pricing" [lede]="positioning">
      <app-grid min="210px" gap="lg">
        @for (point of values; track point.title) {
          <app-feature-tile [icon]="point.icon" [title]="point.title" [text]="point.text" />
        }
      </app-grid>
      <app-data-table [table]="packages" caption="Subscription packages" style="--table-min: 640px" />
      <app-card>
        <h3 class="eyebrow">Commercial rules</h3>
        <app-check-list [items]="rules" icon="arrow-right" tone="muted" />
      </app-card>
    </app-section>
  `,
  styles: 'h3.eyebrow { font-weight: 500; line-height: 1.5; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfferSectionComponent {
  protected readonly positioning = POSITIONING;
  protected readonly values = VALUE_POINTS;
  protected readonly packages = PACKAGES_TABLE;
  protected readonly rules = OFFER_RULES;
}
