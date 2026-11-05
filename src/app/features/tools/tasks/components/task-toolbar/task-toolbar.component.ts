import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BackupActionsComponent, PlanStartFieldComponent } from '../../../../../shared/components';
import {
  CardComponent,
  CheckboxComponent,
  ConfirmButtonComponent,
  SelectFieldComponent,
  SelectOption,
  TextFieldComponent,
} from '../../../../../shared/ui';
import { TaskFilters } from '../../tasks.model';
import { OWNER_FILTER_OPTIONS } from '../../tasks.options';

/** Search, filters, plan start month and backup actions. Emits intents; owns no state. */
@Component({
  selector: 'app-task-toolbar',
  standalone: true,
  imports: [
    CardComponent,
    TextFieldComponent,
    SelectFieldComponent,
    CheckboxComponent,
    ConfirmButtonComponent,
    BackupActionsComponent,
    PlanStartFieldComponent,
  ],
  templateUrl: './task-toolbar.component.html',
  styleUrl: './task-toolbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskToolbarComponent {
  readonly filters = input.required<TaskFilters>();
  readonly goalOptions = input.required<readonly SelectOption[]>();

  readonly filtersChange = output<Partial<TaskFilters>>();
  readonly exportBackup = output<void>();
  readonly importBackup = output<File>();
  readonly reset = output<void>();

  protected readonly ownerOptions = OWNER_FILTER_OPTIONS;
}
