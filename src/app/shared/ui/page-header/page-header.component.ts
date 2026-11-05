import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Top-of-page header: eyebrow, h1, lede, optional actions on the right, then projected extras.
 *   <app-page-header eyebrow="Year 1" title="Clients" lede="…">
 *     <div pageActions><button appButton variant="primary">New client</button></div>
 *     <app-progress-summary … />
 *   </app-page-header>
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="top">
      <div class="titles">
        @if (eyebrow()) {
          <span class="eyebrow">{{ eyebrow() }}</span>
        }
        <h1 class="title-xl">{{ title() }}</h1>
        @if (lede()) {
          <p class="lede">{{ lede() }}</p>
        }
      </div>
      <div class="actions"><ng-content select="[pageActions]" /></div>
    </div>
    <ng-content />
  `,
  styles: `
    :host { display: grid; gap: 16px; padding-block: 36px 24px; }
    .top { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; }
    .titles { display: grid; gap: 16px; min-width: 0; }
    .actions:empty { display: none; }
    .actions ::ng-deep [pageActions] { display: flex; flex-wrap: wrap; gap: 8px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly eyebrow = input('');
  readonly lede = input('');
}
