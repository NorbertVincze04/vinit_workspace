import { ChangeDetectionStrategy, Component } from '@angular/core';
import { COMPARISON, COMPETITION_NOTES } from '../../../../core/data/business.data';
import { CheckListComponent, SectionComponent } from '../../../../shared/ui';
import { ComparisonTableComponent } from '../../components/comparison-table/comparison-table.component';

/** Feature comparison with the main competitors. Anchor: #competition */
@Component({
  selector: 'app-competition-section',
  standalone: true,
  imports: [SectionComponent, ComparisonTableComponent, CheckListComponent],
  template: `
    <app-section id="competition" tone="alt" eyebrow="Business plan · 2.3" title="Competition">
      <app-comparison-table [table]="table" caption="VINIT compared with Mero, Stailer and Booksy" />
      <app-check-list [items]="notes" icon="arrow-right" tone="muted" />
    </app-section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompetitionSectionComponent {
  protected readonly table = COMPARISON;
  protected readonly notes = COMPETITION_NOTES;
}
