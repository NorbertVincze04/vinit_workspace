import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * One entry of an <app-menu>. Put it on a native button so it keeps its semantics.
 *   <button appMenuItem type="button" (click)="export()"><app-icon name="download" /> Export</button>
 */
@Component({
  selector: 'button[appMenuItem]',
  standalone: true,
  template: '<ng-content />',
  styles: `
    :host { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 34px; padding: 6px 10px;
      font-size: 14px; text-align: left; white-space: nowrap; color: var(--ink); background: none; border: 0;
      border-radius: var(--radius-md); cursor: pointer; }
    :host(:hover), :host(:focus-visible) { background: var(--hover); outline: none; }
    :host([data-tone='danger']) { color: var(--red); }
    :host([disabled]) { opacity: 0.5; cursor: not-allowed; }
    @media (pointer: coarse) { :host { min-height: 44px; } }
  `,
  host: { role: 'menuitem', tabindex: '-1', '[attr.data-tone]': 'tone()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuItemComponent {
  readonly tone = input<'default' | 'danger'>('default');
}
