import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { clamp } from '../../../core/utils/format';

/**
 * Thin horizontal meter with an optional target marker. Neutral fill; red when `over`.
 *   <app-meter [value]="62" [marker]="40" label="Direct sales: 62% of appearances, target 40%" />
 */
@Component({
  selector: 'app-meter',
  standalone: true,
  template: `
    <i class="fill" [class.over]="over()" [style.width.%]="width()"></i>
    @if (markerPos() !== null) {
      <b class="marker" [style.left.%]="markerPos()"></b>
    }
  `,
  styles: `
    :host { position: relative; display: block; height: 8px; border-radius: var(--radius-pill); background: var(--progress-track); }
    .fill { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--progress-fill); transition: width 0.4s ease; }
    .fill.over { background: var(--red); }
    .marker { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; border-radius: 1px; background: var(--second); }
  `,
  host: { role: 'img', '[attr.aria-label]': 'label()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeterComponent {
  /** Fill, in percent of the track. */
  readonly value = input(0);
  /** Target marker position in percent; null hides it. */
  readonly marker = input<number | null>(null);
  readonly over = input(false, { transform: booleanAttribute });
  readonly label = input.required<string>();

  protected readonly width = computed(() => clamp(this.value(), 0, 100));
  protected readonly markerPos = computed(() => {
    const m = this.marker();
    return m === null ? null : clamp(m, 0, 100);
  });
}
