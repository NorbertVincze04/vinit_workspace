import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';

export type StatTone = 'default' | 'positive' | 'negative' | 'brand' | 'inverse';

/**
 * A labelled number: small mono label, big display value, optional hint.
 *   <app-stat label="Monthly costs" value="6.380 RON" hint="operational + salaries" />
 */
@Component({
  selector: 'app-stat',
  standalone: true,
  imports: [TPipe],
  template: `
    <span class="label">{{ label() | t }}</span>
    <b class="value">{{ value() }}</b>
    @if (hint()) {
      <span class="hint">{{ hint() | t }}</span>
    }
  `,
  styleUrl: './stat.component.css',
  host: { '[attr.data-tone]': 'tone()', '[attr.data-size]': 'size()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input<string | undefined>('');
  readonly tone = input<StatTone>('default');
  readonly size = input<'md' | 'lg'>('md');
}
