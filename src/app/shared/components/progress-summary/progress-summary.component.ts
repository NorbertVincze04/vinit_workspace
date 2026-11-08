import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProgressBarComponent } from '../../ui';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * Compact "12 of 40 tasks · 30%" line with a progress bar, for page headers.
 *   <app-progress-summary label="12 of 40 tasks done" [percent]="30" ariaLabel="Overall progress" />
 */
@Component({
  selector: 'app-progress-summary',
  standalone: true,
  imports: [TPipe, ProgressBarComponent],
  template: `
    <span class="label">{{ label() | t }}</span>
    <app-progress-bar size="sm" [value]="percent()" [label]="ariaLabel()" />
    <span class="pct">{{ percent() }}%</span>
  `,
  styles: `
    :host { display: grid; grid-template-columns: auto minmax(80px, 1fr) auto; align-items: center; gap: 12px;
      padding: 12px 16px; font-size: 13px; background: var(--surface); border: 1px solid var(--line);
      border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
    .label { color: var(--muted); }
    .pct { font-weight: 600; font-variant-numeric: tabular-nums; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressSummaryComponent {
  readonly label = input.required<string>();
  readonly percent = input.required<number>();
  readonly ariaLabel = input('Overall progress');
}
