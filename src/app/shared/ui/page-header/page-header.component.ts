import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * Top of every page: title, an optional one-line description, actions on the right,
 * then any projected extras (e.g. a summary strip).
 *   <app-page-header title="Clients" description="Salon pipeline and MRR.">
 *     <div pageActions><button appButton variant="primary">New client</button></div>
 *   </app-page-header>
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [TPipe],
  template: `
    <div class="top">
      <div class="titles">
        <h1>{{ title() | t }}</h1>
        @if (description()) {
          <p>{{ description() | t }}</p>
        }
      </div>
      <div class="actions"><ng-content select="[pageActions]" /></div>
    </div>
    <ng-content />
  `,
  styles: `
    :host { display: grid; gap: 16px; margin-bottom: 20px; }
    .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 16px; }
    .titles { display: grid; gap: 2px; min-width: 0; }
    h1 { font-size: 22px; font-weight: 650; }
    p { color: var(--muted); font-size: 14px; }
    .actions:empty { display: none; }
    .actions ::ng-deep [pageActions] { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input('');
}
