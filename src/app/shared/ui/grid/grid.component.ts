import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Responsive auto-fit grid: as many columns as fit at `min` width, one column on phones.
 *   <app-grid min="260px" gap="lg"> <app-card/> <app-card/> </app-grid>
 */
@Component({
  selector: 'app-grid',
  standalone: true,
  template: '<ng-content />',
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(var(--grid-min), 100%), 1fr));
      gap: 16px;
      align-items: start;
    }
    :host([data-gap='sm']) { gap: 10px; }
    :host([data-gap='lg']) { gap: 24px; }
    :host([data-align='stretch']) { align-items: stretch; }
  `,
  host: {
    '[style.--grid-min]': 'min()',
    '[attr.data-gap]': 'gap()',
    '[attr.data-align]': 'align()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridComponent {
  readonly min = input('260px');
  readonly gap = input<'sm' | 'md' | 'lg'>('md');
  readonly align = input<'start' | 'stretch'>('start');
}
