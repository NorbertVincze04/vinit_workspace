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
    <h3 class="title-sm">{{ heading() }}</h3>
    @if (text()) {
      <p>{{ text() }}</p>
    }
    <div class="actions"><ng-content /></div>
  `,
  styles: `
    :host { display: grid; gap: 8px; justify-items: start; padding: 36px 24px; background: var(--surface);
      border: 1px dashed var(--line); border-radius: var(--radius-lg); }
    p { max-width: 56ch; color: var(--muted); }
    .actions { margin-top: 6px; }
    .actions:empty { display: none; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly heading = input.required<string>();
  readonly text = input('');
}
