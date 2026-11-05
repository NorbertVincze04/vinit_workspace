import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';

/**
 * Bulleted list with an icon per line.
 *   <app-check-list [items]="features" />
 *   <app-check-list [items]="problems" icon="close" tone="danger" />
 */
@Component({
  selector: 'app-check-list',
  standalone: true,
  imports: [IconComponent],
  template: `
    <ul>
      @for (item of items(); track $index) {
        <li><app-icon [name]="icon()" [size]="18" [stroke]="2.4" /><span>{{ item }}</span></li>
      }
    </ul>
  `,
  styles: `
    ul { list-style: none; padding: 0; display: grid; gap: 9px; }
    li { display: grid; grid-template-columns: 18px 1fr; gap: 10px; align-items: start; }
    app-icon { margin-top: 2px; color: var(--main); }
    :host([data-tone='danger']) app-icon { color: var(--red); }
    :host([data-tone='muted']) app-icon { color: var(--muted); }
  `,
  host: { '[attr.data-tone]': 'tone()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckListComponent {
  readonly items = input.required<readonly string[]>();
  readonly icon = input<IconName>('check');
  readonly tone = input<'brand' | 'danger' | 'muted'>('brand');
}
