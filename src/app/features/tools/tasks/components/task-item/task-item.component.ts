import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { AutosizeDirective } from '../../../../../shared/directives/autosize.directive';
import {
  BadgeComponent,
  ButtonComponent,
  CheckboxComponent,
  IconComponent,
  SelectOption,
} from '../../../../../shared/ui';
import { TaskPatch, TaskView } from '../../tasks.model';
import { TaskDetailsComponent } from '../task-details/task-details.component';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { TcPipe } from '../../../../../core/i18n/tc.pipe';

/** One task row: done checkbox, editable text, meta badges and the expandable details editor. */
@Component({
  selector: 'app-task-item',
  standalone: true,
  imports: [TcPipe, TPipe, AutosizeDirective, BadgeComponent, ButtonComponent, CheckboxComponent, IconComponent, TaskDetailsComponent],
  templateUrl: './task-item.component.html',
  styleUrl: './task-item.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskItemComponent {
  readonly view = input.required<TaskView>();
  readonly goalOptions = input.required<readonly SelectOption[]>();
  readonly monthOptions = input.required<readonly SelectOption[]>();
  readonly expanded = input(false, { transform: booleanAttribute });
  /** Focus the text box when the item first renders (used for newly added tasks). */
  readonly autofocus = input(false, { transform: booleanAttribute });

  readonly changed = output<TaskPatch>();
  readonly removed = output<void>();
  readonly expandedChange = output<boolean>();

  protected readonly task = computed(() => this.view().task);
  private readonly textBox = viewChild.required<ElementRef<HTMLTextAreaElement>>('textBox');

  constructor() {
    afterNextRender(() => {
      if (this.autofocus()) this.textBox().nativeElement.focus();
    });
  }

  protected onText(event: Event): void {
    this.changed.emit({ text: (event.target as HTMLTextAreaElement).value });
  }

  /** Enter finishes editing instead of adding a new line. */
  protected onEnter(event: Event): void {
    event.preventDefault();
    (event.target as HTMLTextAreaElement).blur();
  }
}
