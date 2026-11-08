import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * VINIT logo: the split "V" mark, optionally followed by the wordmark.
 * Colours come from --logo-left / --logo-right, so it adapts to dark mode.
 *   <app-logo [size]="32" wordmark />
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [TPipe],
  template: `
    <svg class="mark" viewBox="0 0 74 72" aria-hidden="true" focusable="false">
      <path class="right" d="M56 0H72L41 72H36Z" />
      <path class="left" d="M0 0H24L41 72H34Z" />
      <circle class="left" cx="33" cy="7" r="5" />
    </svg>
    @if (wordmark()) {
      <span class="word">{{ 'VINIT' | t }}</span>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 10px; }
    .mark { width: var(--logo-size); height: var(--logo-size); display: block; }
    .left { fill: var(--logo-left); }
    .right { fill: var(--logo-right); }
    .word {
      font-family: var(--font-body); font-weight: 600; letter-spacing: 0.18em;
      font-size: calc(var(--logo-size) * 0.66); line-height: 1; color: var(--main);
    }
  `,
  host: { '[style.--logo-size]': 'sizePx()', role: 'img', 'aria-label': 'VINIT' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoComponent {
  readonly size = input(32);
  readonly wordmark = input(false, { transform: booleanAttribute });

  protected readonly sizePx = computed(() => `${this.size()}px`);
}
