import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { clamp } from '../../../core/utils/format';
import { ButtonComponent } from '../button/button.component';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * − [ 12 ] + control for whole numbers.
 *   <app-number-stepper label="Paying salons" [min]="0" [max]="500" [(value)]="count" />
 */
@Component({
  selector: 'app-number-stepper',
  standalone: true,
  imports: [TPipe, ButtonComponent],
  templateUrl: './number-stepper.component.html',
  styleUrl: './number-stepper.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberStepperComponent {
  readonly value = model(0);
  readonly label = input.required<string>();
  readonly min = input(0);
  readonly max = input(9999);

  protected step(delta: number): void {
    this.commit(this.value() + delta);
  }

  protected onInput(event: Event): void {
    const field = event.target as HTMLInputElement;
    this.commit(parseInt(field.value, 10));
    field.value = String(this.value()); // show the clamped value even if it did not change
  }

  private commit(raw: number): void {
    const next = Number.isNaN(raw) ? this.min() : clamp(raw, this.min(), this.max());
    this.value.set(next);
  }
}
