import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatRon } from '../../../../../core/utils/format';
import { CardComponent } from '../../../../../shared/ui';
import { Totals } from '../../finances.model';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { t } from '../../../../../core/i18n/i18n';

interface Delta {
  text: string;
  tone: 'good' | 'bad' | '';
}

/** Net worth plus this month's income, expenses, investments and what is left, with change vs. last month. */
@Component({
  selector: 'app-finance-overview',
  standalone: true,
  imports: [TPipe, CardComponent],
  templateUrl: './finance-overview.component.html',
  styleUrl: './finance-overview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinanceOverviewComponent {
  readonly netWorth = input.required<{ assets: number; debts: number; invested: number; total: number }>();
  readonly totals = input.required<Totals>();
  readonly previous = input.required<Totals>();
  readonly previousLabel = input.required<string>();

  protected readonly ron = formatRon;
  protected readonly left = computed(() => {
    const t = this.totals();
    return t.income - t.expense - t.invest;
  });

  protected readonly stats = computed(() => {
    const t = this.totals();
    const p = this.previous();
    return [
      { label: 'Income', color: 'var(--chart-1)', value: formatRon(t.income), delta: this.delta(t.income, p.income, true) },
      { label: 'Expenses', color: 'var(--chart-2)', value: formatRon(t.expense), delta: this.delta(t.expense, p.expense, false) },
      { label: 'Invested', color: 'var(--chart-3)', value: formatRon(t.invest), delta: this.delta(t.invest, p.invest, true) },
    ];
  });

  protected readonly savingsRate = computed<Delta>(() => {
    const totals = this.totals();
    if (totals.income <= 0) return { text: '', tone: '' };
    const rate = Math.round(((totals.income - totals.expense) / totals.income) * 100);
    return { text: t('Savings rate {pct}%', { pct: rate }), tone: rate >= 20 ? 'good' : rate < 0 ? 'bad' : '' };
  });

  private delta(current: number, previous: number, upIsGood: boolean): Delta {
    if (!previous && !current) return { text: '', tone: '' };
    if (!previous) return { text: t('Nothing last month'), tone: '' };
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    const up = pct >= 0;
    return {
      text: `${up ? '▲' : '▼'} ${t('{pct}% vs {month}', { pct: Math.abs(Math.round(pct)), month: this.previousLabel() })}`,
      tone: up === upIsGood ? 'good' : 'bad',
    };
  }
}
