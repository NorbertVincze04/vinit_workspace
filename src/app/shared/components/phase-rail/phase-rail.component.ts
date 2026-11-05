import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PhaseProgress } from '../../../core/models';
import { ProgressBarComponent } from '../../ui';

/**
 * Horizontal timeline: optional month numbers, then one thin progress band per phase.
 * Decorative summary of the phase cards below it, so hidden from screen readers.
 *   <app-phase-rail [bands]="bands()" [months]="12" />
 */
@Component({
  selector: 'app-phase-rail',
  standalone: true,
  imports: [ProgressBarComponent],
  template: `
    @if (months() > 0) {
      <div class="months">
        @for (m of monthList(); track m) {
          <span>{{ m }}</span>
        }
      </div>
    }
    <div class="bands" [style.--bands]="bands().length">
      @for (band of bands(); track band.name) {
        <div class="band">
          <span class="name">{{ band.name }}</span>
          <app-progress-bar size="xs" [value]="band.percent" />
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: grid; gap: 8px; margin-block: 8px 20px; }
    .months { display: grid; grid-template-columns: repeat(12, 1fr); text-align: center;
      font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
    .bands { display: grid; grid-template-columns: repeat(var(--bands), minmax(0, 1fr)); gap: 6px; }
    .band { display: grid; gap: 4px; min-width: 0; }
    .name { font-family: var(--font-display); font-weight: 600; font-size: 18px;
      text-transform: uppercase; letter-spacing: 0.04em; }
    @media (max-width: 560px) { .name { font-size: 14px; } }
  `,
  host: { 'aria-hidden': 'true' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhaseRailComponent {
  readonly bands = input.required<readonly PhaseProgress[]>();
  /** Number of month labels to show above the bands (0 hides the row). */
  readonly months = input(0);

  protected readonly monthList = computed(() => Array.from({ length: this.months() }, (_, i) => i + 1));
}
