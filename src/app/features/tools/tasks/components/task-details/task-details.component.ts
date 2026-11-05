import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PhaseId } from '../../../../../core/models';
import {
  ConfirmButtonComponent,
  SelectFieldComponent,
  SelectOption,
  TextFieldComponent,
} from '../../../../../shared/ui';
import { Task, TaskOwner, TaskPatch, TaskPriority } from '../../tasks.model';
import { OWNER_OPTIONS, PHASE_OPTIONS, PRIORITY_OPTIONS } from '../../tasks.options';

/** Expanded editor under a task: goal, owner, priority, phase, due month, notes, delete. */
@Component({
  selector: 'app-task-details',
  standalone: true,
  imports: [SelectFieldComponent, TextFieldComponent, ConfirmButtonComponent],
  templateUrl: './task-details.component.html',
  styleUrl: './task-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDetailsComponent {
  readonly task = input.required<Task>();
  readonly goalOptions = input.required<readonly SelectOption[]>();
  readonly monthOptions = input.required<readonly SelectOption[]>();

  readonly changed = output<TaskPatch>();
  readonly removed = output<void>();

  protected readonly ownerOptions = OWNER_OPTIONS;
  protected readonly priorityOptions = PRIORITY_OPTIONS;
  protected readonly phaseOptions = PHASE_OPTIONS;

  protected setOwner(value: string): void {
    this.changed.emit({ owner: value as TaskOwner });
  }

  protected setPriority(value: string): void {
    this.changed.emit({ prio: value as TaskPriority });
  }

  protected setPhase(value: string): void {
    this.changed.emit({ phase: value as PhaseId });
  }

  protected setDue(value: string): void {
    this.changed.emit({ due: parseInt(value, 10) || 1 });
  }
}
