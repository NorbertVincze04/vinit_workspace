import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent, IconComponent, PanelComponent } from '../../../../../shared/ui';
import { GoalStat } from '../../tasks.model';
import { GoalRowComponent } from '../goal-row/goal-row.component';

/** Goals editor: one editable row per goal plus "Add goal". Deleted goals leave their tasks without a goal. */
@Component({
  selector: 'app-goals-panel',
  standalone: true,
  imports: [PanelComponent, ButtonComponent, IconComponent, GoalRowComponent],
  template: `
    <app-panel heading="Goals" [meta]="goals().length + ' goals'">
      <button panelAction appButton size="sm" type="button" (click)="add.emit()">
        <app-icon name="plus" [size]="16" /> Add goal
      </button>
      <div class="head" aria-hidden="true">
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
    </app-panel>
  `,
  styles: `
    :host { display: block; --goal-columns: minmax(0, 1.2fr) minmax(0, 2fr) 180px 34px; }
    .head { display: grid; grid-template-columns: var(--goal-columns); gap: 10px; font-size: 12px; font-weight: 500;
      color: var(--muted); }
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
