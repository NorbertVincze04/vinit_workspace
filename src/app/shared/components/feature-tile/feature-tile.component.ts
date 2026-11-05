import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent, IconName } from '../../ui';

/**
 * Icon tile + title + short text. Used for value points, sustainability, etc.
 *   <app-feature-tile icon="leaf" title="Paperless" text="…" />
 */
@Component({
  selector: 'app-feature-tile',
  standalone: true,
  imports: [IconComponent],
  template: `
    <span class="tile"><app-icon [name]="icon()" [size]="22" /></span>
    <h3 class="title-sm">{{ title() }}</h3>
    <p class="muted">{{ text() }}</p>
  `,
  styles: `
    :host { display: grid; gap: 10px; align-content: start; min-width: 0; }
    .tile { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 12px;
      background: var(--main-soft); color: var(--main); }
    h3 { margin-top: 4px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureTileComponent {
  readonly icon = input.required<IconName>();
  readonly title = input.required<string>();
  readonly text = input('');
}
