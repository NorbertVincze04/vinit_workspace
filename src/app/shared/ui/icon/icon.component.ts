import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS, IconName } from './icons';

/**
 * Inline stroke icon that inherits the text colour.
 *   <app-icon name="check" [size]="16" />
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" [attr.stroke-width]="stroke()"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    :host { display: inline-flex; flex: none; width: var(--icon-size); height: var(--icon-size); }
    svg { width: 100%; height: 100%; display: block; }
  `,
  host: { '[style.--icon-size]': 'sizePx()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly stroke = input(2);

  protected readonly path = computed(() => ICONS[this.name()]);
  protected readonly sizePx = computed(() => `${this.size()}px`);
}
