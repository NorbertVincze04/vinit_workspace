import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { formatNumber } from '../../../../../core/utils/format';
import { CardComponent, MeterComponent, StatComponent } from '../../../../../shared/ui';
import { AD_BUDGET_YEAR } from '../../marketing.data';
import { MixShare, MonthStats } from '../../marketing.model';

/** Year totals and the communication mix compared with its target shares. */
@Component({
  selector: 'app-marketing-overview',
  standalone: true,
  imports: [CardComponent, StatComponent, MeterComponent],
  templateUrl: './marketing-overview.component.html',
  styleUrl: './marketing-overview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingOverviewComponent {
  readonly totals = input.required<MonthStats & { planned: number }>();
  readonly mix = input.required<readonly MixShare[]>();

  protected readonly adBudgetYear = formatNumber(AD_BUDGET_YEAR);
  protected readonly format = formatNumber;
}
