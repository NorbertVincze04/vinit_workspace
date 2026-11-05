import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface ChipOption {
  value: string;
  label: string;
  /** Optional count shown after the label. */
  count?: number;
}

/**
 * Single-select filter chips.
 *   <app-chip-group label="Filter by status" [options]="statusChips()" [(value)]="status" />
 */
@Component({
  selector: 'app-chip-group',
  standalone: true,
  template: `
    <div class="chips" role="group" [attr.aria-label]="label()">
      @for (option of options(); track option.value) {
        <button type="button" class="chip" [attr.aria-pressed]="option.value === value()" (click)="value.set(option.value)">
          {{ option.label }}
          @if (option.count !== undefined) {
            <span class="n">{{ option.count }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { padding: 6px 12px; font-size: 13px; font-weight: 500; color: var(--ink); background: var(--surface);
      border: 1px solid var(--line); border-radius: var(--radius-pill); cursor: pointer; }
    .chip:hover { border-color: var(--main); }
    .chip[aria-pressed='true'] { color: var(--on-second); background: var(--second); border-color: var(--second); }
    .n { margin-left: 4px; opacity: 0.75; font-variant-numeric: tabular-nums; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChipGroupComponent {
  readonly value = model('');
  readonly options = input.required<readonly ChipOption[]>();
  readonly label = input.required<string>();
}
