import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SUSTAINABILITY } from '../../../../core/data/business.data';
import { FeatureTileComponent } from '../../../../shared/components';
import { GridComponent, SectionComponent } from '../../../../shared/ui';

/** Sustainability measures. Anchor: #sustainability */
@Component({
  selector: 'app-sustainability-section',
  standalone: true,
  imports: [SectionComponent, GridComponent, FeatureTileComponent],
  template: `
    <app-section id="sustainability" tone="alt" eyebrow="Business plan · 6" title="Sustainability">
      <app-grid min="200px" gap="lg">
        @for (point of points; track point.title) {
          <app-feature-tile [icon]="point.icon" [title]="point.title" [text]="point.text" />
        }
      </app-grid>
    </app-section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SustainabilitySectionComponent {
  protected readonly points = SUSTAINABILITY;
}
