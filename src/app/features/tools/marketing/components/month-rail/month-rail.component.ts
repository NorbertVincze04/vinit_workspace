import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { percent } from '../../../../../core/utils/format';
import { MeterComponent } from '../../../../../shared/ui';
import { MONTH_PLAN, PLANNED_APPEARANCES } from '../../marketing.data';
import { MonthStats } from '../../marketing.model';

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
  imports: [MeterComponent],
  template: `
    <div class="rail" role="group" aria-label="Choose a month">
      @for (item of items(); track item.month) {
        <button type="button" class="m" [attr.aria-pressed]="value() === item.month" (click)="value.set(item.month)">
          <span class="name">{{ item.name }}</span>
          <span class="sub">{{ item.sub }}</span>
          <app-meter [value]="pct(item)" [label]="item.published + ' of ' + item.target + ' published'" />
          <span class="count" [class.short]="item.short">{{ item.published }} / {{ item.target }} out</span>
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; overflow-x: auto; margin-bottom: 18px; padding-bottom: 4px; }
    .rail { display: grid; grid-template-columns: repeat(13, minmax(76px, 1fr)); gap: 6px; min-width: 1000px; }
    .m { display: grid; gap: 5px; min-width: 0; padding: 9px 10px 10px; text-align: left; color: var(--ink);
      background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md); cursor: pointer; }
    .m:hover { border-color: var(--main); }
    .m[aria-pressed='true'] { border-color: var(--second); box-shadow: 0 0 0 1px var(--second); }
    .name { font-family: var(--font-display); font-size: 18px; font-weight: 700; line-height: 1.1; }
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
  readonly monthLabel = input.required<(n: number) => string>();

  protected readonly items = computed<RailItem[]>(() => {
    const stats = this.stats();
    const all = stats.reduce(
      (acc, s) => ({ published: acc.published + s.published, appearances: acc.appearances + s.appearances }),
      { published: 0, appearances: 0 },
    );
    return [
      { month: 0, name: 'All', sub: 'Year 1', published: all.published, target: PLANNED_APPEARANCES, short: all.appearances < PLANNED_APPEARANCES },
      ...MONTH_PLAN.map((m, i) => ({
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
