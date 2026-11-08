import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatNumber } from '../../../../../core/utils/format';
import { BadgeComponent, CardComponent } from '../../../../../shared/ui';
import { MonthPlan, MonthStats } from '../../marketing.model';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { TcPipe } from '../../../../../core/i18n/tc.pipe';

/** The selected month's brief from the plan (theme, channel, keywords) and its progress. */
@Component({
  selector: 'app-month-brief',
  standalone: true,
  imports: [TcPipe, TPipe, CardComponent, BadgeComponent],
  template: `
    <app-card>
      <div class="grid">
        <div class="left">
          <span class="eyebrow">{{ 'Month' | t }} {{ month() }}{{ label() ? ' · ' + label() : '' }}</span>
          <h2 class="title-sm">{{ plan().theme | tc }}</h2>
          <p class="el">{{ plan().element | tc }} · {{ plan().where | tc }}</p>
          @if (plan().goal) {
            <p class="goal"><b>{{ 'Goal:' | t }}</b> {{ plan().goal | tc }}</p>
          }
          <div class="tags" [attr.aria-label]="'Keywords' | t">
            @for (k of plan().keywords; track k) {
              <app-badge variant="muted">{{ k | tc }}</app-badge>
            }
          </div>
        </div>
        <dl class="stats">
          <div><dt class="eyebrow">{{ 'Appearances' | t }}</dt><dd [class.short]="stats().appearances < plan().target">{{ stats().appearances }} / {{ plan().target }}</dd></div>
          <div><dt class="eyebrow">{{ 'Published' | t }}</dt><dd>{{ stats().published }}</dd></div>
          <div><dt class="eyebrow">{{ 'Items' | t }}</dt><dd>{{ stats().items }}</dd></div>
          <div><dt class="eyebrow">{{ 'Ad spend' | t }}</dt><dd [class.over]="stats().adSpend > budget()">{{ spend() }} / {{ budget() }} {{ 'RON' | t }}</dd></div>
        </dl>
      </div>
    </app-card>
  `,
  styles: `
    :host { display: block; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 14px 30px; }
    .left { display: grid; gap: 6px; align-content: start; }
    .el { font-size: 13px; color: var(--muted); }
    .goal { font-size: 13.5px; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .stats { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 18px; align-content: start; }
    dd { margin: 0; font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
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
  /** The month in the strategy. */
  readonly plan = input.required<MonthPlan>();

  protected readonly budget = computed(() => this.plan().budget);
  protected readonly spend = computed(() => formatNumber(this.stats().adSpend));
}
