import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { percent } from '../../../../../core/utils/format';
import { MeterComponent } from '../../../../../shared/ui';
import { MonthPlan, MonthStats } from '../../marketing.model';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { t } from '../../../../../core/i18n/i18n';

interface RailItem {
  month: number;
  name: string;
  sub: string;
  published: number;
  target: number;
  short: boolean;
}

/** "All · M1 … M12" month picker showing published vs. planned appearances per month. */
@Component({
  selector: 'app-month-rail',
  standalone: true,
  imports: [TPipe, MeterComponent],
  template: `
    <div class="rail" role="group" [attr.aria-label]="'Choose a month' | t">
      @for (item of items(); track item.month) {
        <button type="button" class="m" [attr.aria-pressed]="value() === item.month" (click)="value.set(item.month)">
          <span class="name">{{ item.name }}</span>
          <span class="sub">{{ item.sub }}</span>
          <app-meter [value]="pct(item)" [label]="item.published + ' of ' + item.target + ' published'" />
          <span class="count" [class.short]="item.short">{{ '{n} / {total} out' | t: { n: item.published, total: item.target } }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; overflow-x: auto; margin-bottom: 16px; padding-bottom: 4px; }
    .rail { display: grid; grid-template-columns: repeat(13, minmax(76px, 1fr)); gap: 6px; min-width: 1000px; }
    .m { display: grid; gap: 5px; min-width: 0; padding: 9px 10px 10px; text-align: left; color: var(--ink);
      background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md); cursor: pointer; }
    .m:hover { border-color: var(--line-strong); }
    .m[aria-pressed='true'] { background: var(--main-soft); border-color: var(--main); box-shadow: 0 0 0 1px var(--main); }
    .name { font-size: 14px; font-weight: 600; line-height: 1.2; }
    .sub, .count { font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .count { font-variant-numeric: tabular-nums; }
    .count.short { color: var(--tone-warn-fg); font-weight: 600; }
    app-meter { height: 4px; }
    /* Phones: fixed-width cards (wide enough for "15 / 15 out") in a swipeable strip. */
    @media (max-width: 760px) {
      :host { scroll-snap-type: x proximity; overscroll-behavior-x: contain; }
      .rail { grid-template-columns: repeat(13, 96px); min-width: 0; width: max-content; }
      .m { scroll-snap-align: start; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthRailComponent {
  /** Selected plan month, 0 = all. */
  readonly value = model(0);
  readonly stats = input.required<readonly MonthStats[]>();
  /** The strategy's 12 months (targets). */
  readonly months = input.required<readonly MonthPlan[]>();
  readonly monthLabel = input.required<(n: number) => string>();
  /** Plan year shown. */
  readonly year = input(1);

  protected readonly items = computed<RailItem[]>(() => {
    const stats = this.stats();
    const all = stats.reduce(
      (acc, s) => ({ published: acc.published + s.published, appearances: acc.appearances + s.appearances }),
      { published: 0, appearances: 0 },
    );
    const planned = this.months().reduce((sum, m) => sum + m.target, 0);
    return [
      { month: 0, name: t('All'), sub: t('Year {n}', { n: this.year() }), published: all.published, target: planned, short: all.appearances < planned },
      ...this.months().map((m, i) => ({
        month: i + 1,
        name: `M${i + 1}`,
        sub: this.monthLabel()(i + 1),
        published: stats[i]?.published ?? 0,
        target: m.target,
        short: (stats[i]?.appearances ?? 0) < m.target,
      })),
    ];
  });

  protected pct(item: RailItem): number {
    return percent(item.published, item.target);
  }
}
