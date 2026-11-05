import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent, CardComponent, IconComponent } from '../../../../../shared/ui';
import { GoalStat } from '../../tasks.model';
import { GoalRowComponent } from '../goal-row/goal-row.component';

/** Goals editor: list of goal rows plus "Add goal". */
@Component({
  selector: 'app-goals-panel',
  standalone: true,
  imports: [CardComponent, ButtonComponent, IconComponent, GoalRowComponent],
  template: `
    <app-card padding="lg">
      <div class="intro">
        <h2 class="title-md">Goals</h2>
        <p class="muted small">
          Edit goal names and targets, add new goals, or remove ones you no longer need (their tasks become “No goal”).
        </p>
      </div>
      <div class="head eyebrow" aria-hidden="true">
        <span>Goal</span><span>Target</span><span>Progress</span><span></span>
      </div>
      @for (stat of goals(); track stat.goal.id) {
        <app-goal-row
          [stat]="stat"
          (nameChange)="rename.emit({ id: stat.goal.id, name: $event })"
          (targetChange)="retarget.emit({ id: stat.goal.id, target: $event })"
          (remove)="remove.emit(stat.goal.id)"
        />
      } @empty {
        <p class="muted">No goals yet.</p>
      }
      <div>
        <button appButton variant="primary" type="button" (click)="add.emit()">
          <app-icon name="plus" [size]="16" /> Add goal
        </button>
      </div>
    </app-card>
  `,
  styles: `
    :host { display: block; margin-top: 28px; --goal-columns: minmax(0, 1.2fr) minmax(0, 2fr) 190px 34px; }
    .intro { display: grid; gap: 6px; }
    .head { display: grid; grid-template-columns: var(--goal-columns); gap: 10px; }
    @media (max-width: 760px) { .head { display: none; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalsPanelComponent {
  readonly goals = input.required<readonly GoalStat[]>();

  readonly add = output<void>();
  readonly rename = output<{ id: string; name: string }>();
  readonly retarget = output<{ id: string; target: string }>();
  readonly remove = output<string>();
}
