import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FieldLabelMode } from './field.types';

/**
 * Labelled text input. `valueChange` fires on every keystroke, `committed` on blur/enter.
 *   <app-text-field label="Notes" [value]="task.notes" (valueChange)="save($event)" />
 *   <app-text-field label="Search" labelMode="hidden" type="search" placeholder="Search…" [(value)]="q" />
 */
@Component({
  selector: 'app-text-field',
  standalone: true,
  template: `
    <label class="field" [attr.data-label]="labelMode()">
      <span class="field-label" [class.sr-only]="labelMode() === 'hidden'">{{ label() }}</span>
      <input class="input" [type]="type()" [value]="value()" [placeholder]="placeholder()"
        (input)="onInput($event)" (change)="committed.emit(value())" />
    </label>
  `,
  styleUrl: './field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextFieldComponent {
  readonly value = model('');
  readonly label = input.required<string>();
  readonly labelMode = input<FieldLabelMode>('stacked');
  readonly type = input<'text' | 'search' | 'month' | 'email' | 'url'>('text');
  readonly placeholder = input('');

  readonly committed = output<string>();

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
