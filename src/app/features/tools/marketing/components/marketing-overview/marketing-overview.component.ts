import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { formatNumber } from '../../../../../core/utils/format';
import { CardComponent, MeterComponent, StatComponent } from '../../../../../shared/ui';
import { MixShare, MonthStats } from '../../marketing.model';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { TcPipe } from '../../../../../core/i18n/tc.pipe';

/** Year totals and the communication mix compared with its target shares. */
@Component({
  selector: 'app-marketing-overview',
  standalone: true,
  imports: [TcPipe, TPipe, CardComponent, StatComponent, MeterComponent],
  templateUrl: './marketing-overview.component.html',
  styleUrl: './marketing-overview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingOverviewComponent {
  readonly totals = input.required<MonthStats & { planned: number }>();
  readonly mix = input.required<readonly MixShare[]>();
  /** The strategy's ad budget for the year, RON. */
  readonly adBudgetYear = input.required<number>();

  protected readonly format = formatNumber;
}
