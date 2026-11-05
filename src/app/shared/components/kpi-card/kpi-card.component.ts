import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent, IconComponent, ProgressBarComponent, StatComponent, StatTone } from '../../ui';

/**
 * Dashboard tile: a statistic, optional progress bar and optional link to the tool it comes from.
 *   <app-kpi-card label="Paying salons" value="12 / 50" hint="31 to break-even" [percent]="24" route="/tools/roadmap" />
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [RouterLink, CardComponent, StatComponent, ProgressBarComponent, IconComponent],
  template: `
    <app-card>
      <app-stat [label]="label()" [value]="value()" [hint]="hint()" [tone]="tone()" />
      @if (hasPercent()) {
        <app-progress-bar size="sm" [value]="percentValue()" [label]="label() + ' progress'" />
      }
      @if (route()) {
        <a class="link" [routerLink]="route()">{{ linkLabel() }} <app-icon name="arrow-right" [size]="14" /></a>
      }
    </app-card>
  `,
  styles: `
    :host { display: block; min-width: 0; height: 100%; }
    app-card { height: 100%; grid-template-rows: 1fr auto auto; }
    .link { display: inline-flex; align-items: center; gap: 6px; justify-self: start;
      font-size: 13px; font-weight: 600; color: var(--main); text-decoration: none; }
    @media (pointer: coarse) { .link { min-height: 36px; margin-block: -8px; } }
    .link:hover { text-decoration: underline; }
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
  readonly linkLabel = input('Open');

  protected readonly hasPercent = computed(() => this.percent() !== null);
  protected readonly percentValue = computed(() => this.percent() ?? 0);
}
