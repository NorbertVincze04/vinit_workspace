import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { FieldLabelMode, SelectOption } from './field.types';

/**
 * Labelled <select> driven by an options array.
 *   <app-select-field label="Owner" [options]="owners" [value]="task.owner" (valueChange)="setOwner($event)" />
 */
@Component({
  selector: 'app-select-field',
  standalone: true,
  template: `
    <label class="field" [attr.data-label]="labelMode()">
      <span class="field-label" [class.sr-only]="labelMode() === 'hidden'">{{ label() }}</span>
      <select class="input" (change)="onChange($event)">
        @for (option of options(); track option.value) {
          <option [value]="option.value" [selected]="option.value === value()">{{ option.label }}</option>
        }
      </select>
    </label>
  `,
  styleUrl: './field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectFieldComponent {
  readonly value = model('');
  readonly options = input.required<readonly SelectOption[]>();
  readonly label = input.required<string>();
  readonly labelMode = input<FieldLabelMode>('stacked');

  protected onChange(event: Event): void {
    this.value.set((event.target as HTMLSelectElement).value);
  }
}
