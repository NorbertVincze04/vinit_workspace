import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PlanStartFieldComponent } from '../../../../../shared/components';
import { CheckboxComponent, SelectFieldComponent, SelectOption, TextFieldComponent } from '../../../../../shared/ui';
import { TaskFilters } from '../../tasks.model';
import { OWNER_FILTER_OPTIONS } from '../../tasks.options';
import { TPipe } from '../../../../../core/i18n/t.pipe';

/** Search, filters and the plan start month. Emits intents; owns no state. */
@Component({
  selector: 'app-task-toolbar',
  standalone: true,
  imports: [TPipe, TextFieldComponent, SelectFieldComponent, CheckboxComponent, PlanStartFieldComponent],
  templateUrl: './task-toolbar.component.html',
  styleUrl: './task-toolbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskToolbarComponent {
  readonly filters = input.required<TaskFilters>();
  readonly goalOptions = input.required<readonly SelectOption[]>();

  readonly filtersChange = output<Partial<TaskFilters>>();

  protected readonly ownerOptions = OWNER_FILTER_OPTIONS;
}
