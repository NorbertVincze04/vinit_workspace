import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FieldLabelMode } from './field.types';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * Labelled text input. `valueChange` fires on every keystroke, `committed` on blur/enter.
 *   <app-text-field label="Notes" [value]="task.notes" (valueChange)="save($event)" />
 *   <app-text-field label="Search" labelMode="hidden" type="search" placeholder="Search…" [(value)]="q" />
 */
@Component({
  selector: 'app-text-field',
  standalone: true,
  imports: [TPipe],
  template: `
    <label class="field" [attr.data-label]="labelMode()">
      <span class="field-label" [class.sr-only]="labelMode() === 'hidden'">{{ label() | t }}</span>
      <input class="input" [type]="type()" [value]="value()" [placeholder]="placeholder() | t"
        [attr.name]="name() || null" [attr.autocomplete]="autocomplete() || null" [attr.aria-invalid]="invalid() || null"
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
  readonly type = input<'text' | 'search' | 'month' | 'email' | 'url' | 'password'>('text');
  readonly placeholder = input('');
  /** Helps browsers and password managers fill the field ("username", "current-password"…). */
  readonly autocomplete = input('');
  readonly name = input('');
  readonly invalid = input(false);

  readonly committed = output<string>();

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
