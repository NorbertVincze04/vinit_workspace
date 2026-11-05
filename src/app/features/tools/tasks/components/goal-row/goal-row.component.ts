import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ConfirmButtonComponent, ProgressBarComponent, TextFieldComponent } from '../../../../../shared/ui';
import { GoalStat } from '../../tasks.model';

/** Editable goal: name, target, progress across its tasks, delete. */
@Component({
  selector: 'app-goal-row',
  standalone: true,
  imports: [TextFieldComponent, ProgressBarComponent, ConfirmButtonComponent],
  template: `
    <app-text-field label="Goal name" labelMode="hidden" [value]="stat().goal.name" (valueChange)="nameChange.emit($event)" />
    <app-text-field label="Goal target" labelMode="hidden" [value]="stat().goal.target" (valueChange)="targetChange.emit($event)" />
    <div class="progress">
      <app-progress-bar size="sm" [value]="stat().percent" [label]="stat().goal.name + ' progress'" />
      <span class="count">{{ stat().done }} of {{ stat().total }} tasks</span>
    </div>
    <app-confirm-button label="✕" confirmLabel="?" ariaLabel="Delete goal" size="sm" iconOnly (confirmed)="remove.emit()" />
  `,
  styles: `
    :host { display: grid; grid-template-columns: var(--goal-columns); gap: 10px; align-items: center; }
    .progress { display: grid; gap: 4px; }
    .count { text-align: right; font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
    @media (max-width: 760px) {
      :host { grid-template-columns: 1fr auto; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
      app-text-field, .progress { grid-column: 1 / -1; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalRowComponent {
  readonly stat = input.required<GoalStat>();

  readonly nameChange = output<string>();
  readonly targetChange = output<string>();
  readonly remove = output<void>();
}
