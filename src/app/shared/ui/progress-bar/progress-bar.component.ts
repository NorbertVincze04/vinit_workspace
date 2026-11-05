import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { clamp } from '../../../core/utils/format';

export type ProgressSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * Accessible progress bar in a simple neutral colour (--progress-fill on --progress-track).
 *   <app-progress-bar [value]="42" label="Overall progress" size="lg" />
 */
@Component({
  selector: 'app-progress-bar',
  standalone: true,
  template: '<div class="fill" [style.width.%]="safeValue()"></div>',
  styleUrl: './progress-bar.component.css',
  host: {
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-valuenow]': 'safeValue()',
    '[attr.aria-label]': 'label() || null',
    '[attr.data-size]': 'size()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBarComponent {
  /** 0–100 */
  readonly value = input(0);
  readonly label = input('');
  readonly size = input<ProgressSize>('md');

  protected readonly safeValue = computed(() => clamp(Math.round(this.value()), 0, 100));
}
