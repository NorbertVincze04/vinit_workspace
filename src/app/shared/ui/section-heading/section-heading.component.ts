import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Eyebrow + h2 + lede block used at the top of sections.
 *   <app-section-heading eyebrow="Pricing" title="Three packages" lede="…" />
 */
@Component({
  selector: 'app-section-heading',
  standalone: true,
  template: `
    @if (eyebrow()) {
      <span class="eyebrow">{{ eyebrow() }}</span>
    }
    <h2 class="title-md">{{ title() }}</h2>
    @if (lede()) {
      <p class="lede">{{ lede() }}</p>
    }
  `,
  styles: `
    :host { display: grid; gap: 8px; justify-items: start; }
    .lede { font-size: 15px; }
    :host([data-align='center']) { justify-items: center; text-align: center; }
  `,
  host: { '[attr.data-align]': 'align()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionHeadingComponent {
  readonly title = input.required<string>();
  readonly eyebrow = input('');
  readonly lede = input('');
  readonly align = input<'start' | 'center'>('start');
}
