import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Right-aligned money cell: main amount plus an optional RON conversion line.
 * `kind` colours income green and negatives red; everything else stays in ink.
 *   <app-amount text="+1.200 RON" kind="income" />
 */
@Component({
  selector: 'app-amount',
  standalone: true,
  template: `
    @if (label()) {
      <span class="lbl">{{ label() }}</span>
    }
    <span class="amt" [attr.data-kind]="kind()">{{ text() }}</span>
    @if (sub()) {
      <span class="sub">{{ sub() }}</span>
    }
  `,
  styles: `
    :host { display: grid; justify-items: end; text-align: right; font-variant-numeric: tabular-nums; }
    .amt { font-weight: 700; font-size: 15.5px; white-space: nowrap; }
    .amt[data-kind='income'], .amt[data-kind='positive'] { color: var(--good); }
    .amt[data-kind='negative'] { color: var(--red); }
    .sub { font-size: 12.5px; color: var(--muted); }
    .lbl { display: none; font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; color: var(--muted); }
    @media (max-width: 760px) { :host { justify-items: start; text-align: left; } .lbl { display: block; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmountComponent {
  readonly text = input.required<string>();
  readonly sub = input('');
  /** Column name, shown only on phones where the header row is hidden. */
  readonly label = input('');
  readonly kind = input<string>('plain');
}
