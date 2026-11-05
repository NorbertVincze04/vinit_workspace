import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatNumber } from '../../../../../core/utils/format';
import { BadgeComponent, CardComponent } from '../../../../../shared/ui';
import { AD_BUDGET_MONTH, MONTH_PLAN } from '../../marketing.data';
import { MonthStats } from '../../marketing.model';

/** The selected month's brief from the plan (theme, channel, keywords) and its progress. */
@Component({
  selector: 'app-month-brief',
  standalone: true,
  imports: [CardComponent, BadgeComponent],
  template: `
    <app-card>
      <div class="grid">
        <div class="left">
          <span class="eyebrow">Month {{ month() }}{{ label() ? ' · ' + label() : '' }}</span>
          <h2 class="title-sm">{{ plan().theme }}</h2>
          <p class="el">{{ plan().element }} · {{ plan().where }}</p>
          <div class="tags" aria-label="Keywords">
            @for (k of plan().keywords; track k) {
              <app-badge variant="muted">{{ k }}</app-badge>
            }
          </div>
        </div>
        <dl class="stats">
          <div><dt class="eyebrow">Appearances</dt><dd [class.short]="stats().appearances < plan().target">{{ stats().appearances }} / {{ plan().target }}</dd></div>
          <div><dt class="eyebrow">Published</dt><dd>{{ stats().published }}</dd></div>
          <div><dt class="eyebrow">Items</dt><dd>{{ stats().items }}</dd></div>
          <div><dt class="eyebrow">Ad spend</dt><dd [class.over]="stats().adSpend > budget">{{ spend() }} / {{ budget }} RON</dd></div>
        </dl>
      </div>
    </app-card>
  `,
  styles: `
    :host { display: block; margin-bottom: 18px; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 14px 30px; }
    .left { display: grid; gap: 6px; align-content: start; }
    .el { font-size: 13.5px; font-weight: 600; color: var(--heading); }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .stats { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 18px; align-content: start; }
    dd { margin: 0; font-family: var(--font-display); font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; }
    dd.short { color: var(--tone-warn-fg); }
    dd.over { color: var(--red); }
    @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthBriefComponent {
  readonly month = input.required<number>();
  readonly label = input('');
  readonly stats = input.required<MonthStats>();

  protected readonly budget = AD_BUDGET_MONTH;
  protected readonly plan = computed(() => MONTH_PLAN[this.month() - 1] ?? MONTH_PLAN[0]);
  protected readonly spend = computed(() => formatNumber(this.stats().adSpend));
}
