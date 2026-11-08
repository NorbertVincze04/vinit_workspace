import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';

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
  imports: [TPipe],
  template: `
    <div class="chips" role="group" [attr.aria-label]="label() | t">
      @for (option of options(); track option.value) {
        <button type="button" class="chip" [attr.aria-pressed]="option.value === value()" (click)="value.set(option.value)">
          {{ option.label | t }}
          @if (option.count !== undefined) {
            <span class="n">{{ option.count }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { height: 30px; padding: 0 11px; font-size: 13px; font-weight: 500; color: var(--muted); background: var(--surface);
      border: 1px solid var(--line); border-radius: var(--radius-pill); cursor: pointer; }
    .chip:hover { color: var(--ink); border-color: var(--line-strong); }
    .chip[aria-pressed='true'] { color: var(--main-ink); background: var(--main-soft);
      border-color: color-mix(in srgb, var(--main) 45%, transparent); }
    .n { margin-left: 4px; opacity: 0.7; font-variant-numeric: tabular-nums; }
    @media (pointer: coarse) { .chip { height: 36px; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChipGroupComponent {
  readonly value = model('');
  readonly options = input.required<readonly ChipOption[]>();
  readonly label = input.required<string>();
}
