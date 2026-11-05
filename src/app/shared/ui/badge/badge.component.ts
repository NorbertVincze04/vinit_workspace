import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeVariant = 'soft' | 'solid' | 'outline' | 'muted' | 'danger' | 'second';

/**
 * Small pill label for tags, statuses and meta info.
 *   <app-badge variant="danger">Overdue</app-badge>
 */
@Component({
  selector: 'app-badge',
  standalone: true,
  template: '<ng-content />',
  styleUrl: './badge.component.css',
  host: { '[attr.data-variant]': 'variant()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  readonly variant = input<BadgeVariant>('soft');
}
