import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Styles a native <button> or <a> so it keeps its semantics (type, disabled, routerLink, href).
 *   <button appButton variant="primary" type="button">Save</button>
 *   <a appButton routerLink="/tools/tasks">Open tasks</a>
 *   <button appButton variant="ghost" iconOnly aria-label="Menu"><app-icon name="menu" /></button>
 */
@Component({
  selector: 'button[appButton], a[appButton]',
  standalone: true,
  template: '<ng-content />',
  styleUrl: './button.component.css',
  host: {
    class: 'btn',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
    '[class.btn--block]': 'block()',
    '[class.btn--icon]': 'iconOnly()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly block = input(false, { transform: booleanAttribute });
  readonly iconOnly = input(false, { transform: booleanAttribute });
}
