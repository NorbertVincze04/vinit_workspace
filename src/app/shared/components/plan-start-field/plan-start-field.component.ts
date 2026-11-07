import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PlanCalendarService } from '../../../core/services/plan-calendar.service';
import { TextFieldComponent } from '../../ui';

/**
 * "Month 1 = [Dec 2026]" picker bound to the shared plan calendar. Changing it updates every tool.
 *   <app-plan-start-field />
 */
@Component({
  selector: 'app-plan-start-field',
  standalone: true,
  imports: [TextFieldComponent],
  template: `
    <app-text-field
      type="month"
      label="Plan starts"
      labelMode="inline"
      [value]="plan.start()"
      (valueChange)="plan.setStart($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanStartFieldComponent {
  protected readonly plan = inject(PlanCalendarService);
}
