import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { ChipOption } from '../chip-group/chip-group.component';

/**
 * Underlined tab bar (with optional counts). Render the matching panel yourself with @switch.
 *   <app-tabs label="Ledger sections" [options]="tabs()" [(value)]="tab" />
 */
@Component({
  selector: 'app-tabs',
  standalone: true,
  template: `
    <div class="tabs" role="tablist" [attr.aria-label]="label()">
      @for (option of options(); track option.value) {
        <button type="button" role="tab" class="tab" [attr.aria-selected]="option.value === value()" (click)="value.set(option.value)">
          {{ option.label }}
          @if (option.count !== undefined) {
            <span class="n">{{ option.count }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    /* The base line is an inset shadow (painted under the tabs) rather than a border + negative
       margin, which overflowed by 1px and showed a stray vertical scrollbar. */
    .tabs { display: flex; gap: 2px; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin;
      overscroll-behavior-x: contain; box-shadow: inset 0 -1px 0 var(--line); }
    .tab { flex: none; padding: 10px 14px 11px; font-size: 14.5px; font-weight: 600; white-space: nowrap;
      color: var(--muted); background: none; border: 0; border-bottom: 2px solid transparent; cursor: pointer; }
    .tab:hover { color: var(--ink); }
    .tab[aria-selected='true'] { color: var(--heading); border-bottom-color: var(--main); }
    .n { margin-left: 5px; font-weight: 500; color: var(--muted); font-variant-numeric: tabular-nums; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsComponent {
  readonly value = model('');
  readonly options = input.required<readonly ChipOption[]>();
  readonly label = input.required<string>();
}
