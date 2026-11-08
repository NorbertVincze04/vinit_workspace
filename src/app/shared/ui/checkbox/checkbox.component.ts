import { ChangeDetectionStrategy, Component, booleanAttribute, input, model } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * Branded checkbox. Projected content is the label.
 *   <app-checkbox [(checked)]="done">Ship the MVP</app-checkbox>
 *   <app-checkbox variant="row" strike [checked]="x" (checkedChange)="save($event)">…</app-checkbox>
 *   <app-checkbox ariaLabel="Done" [checked]="x" />          (no visible label)
 */
@Component({
  selector: 'app-checkbox',
  standalone: true,
  imports: [TPipe],
  templateUrl: './checkbox.component.html',
  styleUrl: './checkbox.component.css',
  host: { '[attr.data-variant]': 'variant()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckboxComponent {
  readonly checked = model(false);
  readonly ariaLabel = input('');
  /** `row` = full-width clickable row with hover background (checklists). */
  readonly variant = input<'plain' | 'row'>('plain');
  /** Strike through the label when checked. */
  readonly strike = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  protected onChange(event: Event): void {
    this.checked.set((event.target as HTMLInputElement).checked);
  }
}
