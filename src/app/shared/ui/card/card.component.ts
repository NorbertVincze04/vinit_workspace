import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

export type CardTone = 'default' | 'soft' | 'inverse';
export type CardPadding = 'sm' | 'md' | 'lg';

/**
 * Surface container. Children are laid out in a vertical grid with a consistent gap.
 *   <app-card padding="lg" highlight> ... </app-card>
 */
@Component({
  selector: 'app-card',
  standalone: true,
  template: '<ng-content />',
  styleUrl: './card.component.css',
  host: {
    '[attr.data-tone]': 'tone()',
    '[attr.data-padding]': 'padding()',
    '[class.is-highlight]': 'highlight()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  readonly tone = input<CardTone>('default');
  readonly padding = input<CardPadding>('md');
  readonly highlight = input(false, { transform: booleanAttribute });
}
