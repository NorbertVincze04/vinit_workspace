import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SectionHeadingComponent } from '../section-heading/section-heading.component';

export type SectionTone = 'default' | 'alt';

/**
 * Full-width page band with a centred container, an optional heading and projected content.
 * Give it an `id` to link to it: <a routerLink="/" fragment="packages">.
 *   <app-section id="packages" tone="alt" eyebrow="Pricing" title="Three packages"> … </app-section>
 */
@Component({
  selector: 'app-section',
  standalone: true,
  imports: [SectionHeadingComponent],
  template: `
    <div class="container inner">
      @if (title()) {
        <app-section-heading [eyebrow]="eyebrow()" [title]="title()" [lede]="lede()" [align]="align()" />
      }
      <ng-content />
    </div>
  `,
  styles: `
    :host { display: block; padding-block: var(--section-pad); }
    :host([data-tone='alt']) { background: var(--surface); border-block: 1px solid var(--line); }
    .inner { display: grid; gap: 24px; }
  `,
  host: { '[attr.data-tone]': 'tone()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionComponent {
  readonly title = input('');
  readonly eyebrow = input('');
  readonly lede = input('');
  readonly align = input<'start' | 'center'>('start');
  readonly tone = input<SectionTone>('default');
}
