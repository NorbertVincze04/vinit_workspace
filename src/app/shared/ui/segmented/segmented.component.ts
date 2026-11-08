import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { SelectOption } from '../form-field/field.types';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * Segmented switch for a few mutually exclusive options (e.g. Income / Expense / Invest).
 *   <app-segmented label="Type" [options]="types" [(value)]="type" />
 */
@Component({
  selector: 'app-segmented',
  standalone: true,
  imports: [TPipe],
  template: `
    <div class="seg" role="group" [attr.aria-label]="label() | t" [style.--seg-count]="options().length">
      @for (option of options(); track option.value) {
        <button type="button" [attr.aria-pressed]="option.value === value()" (click)="value.set(option.value)">
          {{ option.label | t }}
        </button>
      }
    </div>
  `,
  styles: `
    .seg { display: grid; grid-template-columns: repeat(var(--seg-count), minmax(0, 1fr)); gap: 3px; padding: 3px;
      background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-md); }
    button { padding: 6px; font-size: 13.5px; font-weight: 500; color: var(--muted); background: none;
      border: 0; border-radius: var(--radius-sm); cursor: pointer; }
    button[aria-pressed='true'] { color: var(--ink); background: var(--surface); box-shadow: var(--shadow-sm); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentedComponent {
  readonly value = model('');
  readonly options = input.required<readonly SelectOption[]>();
  readonly label = input.required<string>();
}
