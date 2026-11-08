import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';

export interface InlineStat {
  label: string;
  value: string;
  /** Text after the value, e.g. "/ month". */
  suffix?: string;
  tone?: 'default' | 'positive' | 'negative';
}

/**
 * One-line summary above a list: "12 entries · In 4.500 RON · Out 2.100 RON".
 *   <app-inline-stats [items]="summary()" />
 */
@Component({
  selector: 'app-inline-stats',
  standalone: true,
  imports: [TPipe],
  template: `
    @for (item of items(); track item.label) {
      <span>
        {{ item.label | t }}
        <strong [attr.data-tone]="item.tone || 'default'">{{ item.value }}</strong>
        @if (item.suffix) {
          {{ item.suffix | t }}
        }
      </span>
    }
  `,
  styles: `
    :host { display: flex; flex-wrap: wrap; gap: 4px 20px; font-size: 13.5px; color: var(--muted); }
    strong { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
    strong[data-tone='positive'] { color: var(--good); }
    strong[data-tone='negative'] { color: var(--red); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineStatsComponent {
  readonly items = input.required<readonly InlineStat[]>();
}
