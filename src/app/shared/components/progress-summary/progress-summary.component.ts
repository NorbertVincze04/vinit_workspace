import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProgressBarComponent } from '../../ui';

/**
 * "12 of 40 tasks ……… 30%" line with a large progress bar underneath.
 *   <app-progress-summary label="12 of 40 tasks" [percent]="30" ariaLabel="Overall progress" />
 */
@Component({
  selector: 'app-progress-summary',
  standalone: true,
  imports: [ProgressBarComponent],
  template: `
    <div class="row">
      <span class="eyebrow">{{ label() }}</span>
      <span class="pct">{{ percent() }}%</span>
    </div>
    <app-progress-bar size="lg" [value]="percent()" [label]="ariaLabel()" />
  `,
  styles: `
    :host { display: grid; gap: 10px; margin-top: 6px; }
    .row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
    .pct { font-family: var(--font-display); font-weight: 700; font-size: 34px; line-height: 1; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressSummaryComponent {
  readonly label = input.required<string>();
  readonly percent = input.required<number>();
  readonly ariaLabel = input('Overall progress');
}
