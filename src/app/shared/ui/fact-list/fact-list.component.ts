import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Fact } from '../../../core/models';

/**
 * Label → value list (a <dl>), one row per fact. Stacks on phones.
 *   <app-fact-list [items]="facts" />
 */
@Component({
  selector: 'app-fact-list',
  standalone: true,
  template: `
    <dl>
      @for (fact of items(); track fact.label) {
        <div class="row">
          <dt class="eyebrow">{{ fact.label }}</dt>
          <dd>{{ fact.value }}</dd>
        </div>
      }
    </dl>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    dl { margin: 0; display: grid; }
    .row { display: grid; grid-template-columns: var(--fact-label-width, 150px) 1fr; gap: 12px;
      padding-block: 10px; border-top: 1px solid var(--line); }
    .row:first-child { border-top: 0; padding-top: 0; }
    .row:last-child { padding-bottom: 0; }
    dt { padding-top: 2px; }
    dd { margin: 0; min-width: 0; }
    @media (max-width: 480px) { .row { grid-template-columns: 1fr; gap: 2px; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FactListComponent {
  readonly items = input.required<readonly Fact[]>();
}
