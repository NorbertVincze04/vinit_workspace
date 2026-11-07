import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusPillComponent, StatusTone } from '../status-pill/status-pill.component';

export interface Fact {
  label: string;
  /** Shown as "—" when empty. */
  value: string;
  /** Show the value as a status pill. */
  tone?: StatusTone;
  /** External link (opens in a new tab). */
  href?: string;
  /** In-app link. */
  route?: string;
  /** Small text under the value. */
  hint?: string;
  /** Highlight the value as a problem (e.g. "Address missing"). */
  warn?: boolean;
}

/**
 * Label / value pairs for detail pages, in as many columns as fit (one on phones).
 *   <app-facts [items]="[{ label: 'Plan', value: 'Premium' }, { label: 'Status', value: 'Active', tone: 'ok' }]" />
 */
@Component({
  selector: 'app-facts',
  standalone: true,
  imports: [RouterLink, StatusPillComponent],
  template: `
    <dl>
      @for (f of items(); track f.label) {
        <div class="fact">
          <dt>{{ f.label }}</dt>
          <dd [class.warn]="f.warn">
            @if (!f.value) {
              <span class="empty">—</span>
            } @else if (f.tone) {
              <app-status-pill [tone]="f.tone">{{ f.value }}</app-status-pill>
            } @else if (f.href) {
              <a [href]="f.href" target="_blank" rel="noopener noreferrer">{{ f.value }}</a>
            } @else if (f.route) {
              <a [routerLink]="f.route">{{ f.value }}</a>
            } @else {
              {{ f.value }}
            }
            @if (f.hint) {
              <span class="hint">{{ f.hint }}</span>
            }
          </dd>
        </div>
      }
    </dl>
  `,
  styles: `
    dl { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(135px, 100%), 1fr)); gap: 14px 20px; margin: 0; }
    .fact { display: grid; gap: 3px; min-width: 0; align-content: start; }
    dt { font-size: 12px; font-weight: 500; color: var(--muted); }
    dd { margin: 0; font-size: 14px; overflow-wrap: anywhere; white-space: pre-line; }
    dd.warn { color: var(--red); font-weight: 600; }
    .empty { color: var(--muted); }
    .hint { display: block; font-size: 12.5px; color: var(--muted); font-weight: 400; }
    a { color: var(--main); text-decoration: none; }
    a:hover { text-decoration: underline; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FactsComponent {
  readonly items = input.required<readonly Fact[]>();
}
