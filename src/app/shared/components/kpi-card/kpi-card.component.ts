import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, ProgressBarComponent, StatTone } from '../../ui';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * Dashboard tile: label, figure, hint and optional progress. With a `route` the whole tile is a link.
 *   <app-kpi-card label="Active clients" value="12 / 50" hint="31 to break-even" [percent]="24" route="/tools/clients" />
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [TPipe, NgTemplateOutlet, RouterLink, IconComponent, ProgressBarComponent],
  template: `
    @if (route()) {
      <a class="tile is-link" [routerLink]="route()"><ng-container [ngTemplateOutlet]="body" /></a>
    } @else {
      <div class="tile"><ng-container [ngTemplateOutlet]="body" /></div>
    }
    <ng-template #body>
      <span class="label">
        {{ label() | t }}
        @if (route()) {
          <app-icon class="go" name="arrow-right" [size]="14" />
        }
      </span>
      <b class="value" [attr.data-tone]="tone()">{{ value() }}</b>
      @if (percent() !== null) {
        <app-progress-bar size="sm" [value]="percentValue()" [label]="label() + ' progress'" />
      }
      @if (hint()) {
        <span class="hint">{{ hint() | t }}</span>
      }
    </ng-template>
  `,
  styles: `
    :host { display: block; min-width: 0; height: 100%; }
    .tile { display: grid; gap: 6px; align-content: start; height: 100%; padding: 16px 18px; color: var(--ink);
      text-decoration: none; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm); transition: border-color 0.12s ease, box-shadow 0.12s ease; }
    .tile.is-link:hover { border-color: var(--line-strong); box-shadow: var(--shadow-md); }
    .label { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px;
      font-weight: 500; color: var(--muted); }
    .go { opacity: 0; transition: opacity 0.12s ease; }
    .tile.is-link:hover .go, .tile.is-link:focus-visible .go { opacity: 1; }
    .value { font-size: 22px; font-weight: 600; line-height: 1.25; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
    .value[data-tone='positive'] { color: var(--good); }
    .value[data-tone='negative'] { color: var(--red); }
    .hint { font-size: 12.5px; color: var(--muted); }
    app-progress-bar { margin-top: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input('');
  readonly tone = input<StatTone>('default');
  /** 0–100; null hides the bar. */
  readonly percent = input<number | null>(null);
  readonly route = input('');
  protected readonly percentValue = computed(() => this.percent() ?? 0);
}
