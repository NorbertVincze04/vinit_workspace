import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Placeholder for an empty list, with an optional projected action.
 *   <app-empty-state heading="No clients yet" text="Add the first salon you onboard.">
 *     <button appButton variant="primary">Add client</button>
 *   </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <h3>{{ heading() }}</h3>
    @if (text()) {
      <p>{{ text() }}</p>
    }
    <div class="actions"><ng-content /></div>
  `,
  styles: `
    :host { display: grid; gap: 4px; justify-items: center; padding: 40px 24px; text-align: center;
      background: var(--surface); border: 1px dashed var(--line-strong); border-radius: var(--radius-lg); }
    h3 { font-size: 15px; }
    p { max-width: 52ch; color: var(--muted); }
    .actions { margin-top: 12px; }
    .actions:empty { display: none; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly heading = input.required<string>();
  readonly text = input('');
}
