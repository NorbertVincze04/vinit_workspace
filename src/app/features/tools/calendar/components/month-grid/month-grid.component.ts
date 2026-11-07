import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { todayISO } from '../../../../../core/utils/date';
import { Deadline, monthWeeks, whenInfo } from '../../calendar.model';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Month calendar (Monday first) with each day's deadlines; tap one to open it. */
@Component({
  selector: 'app-month-grid',
  standalone: true,
  template: `
    <div class="grid" role="grid" [attr.aria-label]="'Deadlines in ' + month()">
      @for (d of days; track d) {
        <div class="head" role="columnheader">{{ d }}</div>
      }
      @for (week of weeks(); track week[0]) {
        @for (day of week; track day) {
          <div class="day" role="gridcell" [class.other]="day.slice(0, 7) !== month()" [class.today]="day === today">
            <span class="num">{{ +day.slice(8) }}</span>
            @for (d of byDay().get(day) ?? []; track d.id) {
              <button type="button" class="item" [attr.data-tone]="tone(d)" [class.closed]="d.status !== 'open'" (click)="open.emit(d)">
                {{ d.title }}
              </button>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border: 1px solid var(--line); border-radius: var(--radius-lg);
      overflow: hidden; background: var(--surface); }
    .head { padding: 8px; font-size: 12px; font-weight: 600; color: var(--muted); border-bottom: 1px solid var(--line); text-align: center; }
    .day { min-height: 96px; padding: 6px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); display: grid;
      align-content: start; gap: 3px; min-width: 0; }
    .day:nth-child(7n + 7) { border-right: 0; }
    .day.other { background: var(--hover); }
    .day.other .num { color: var(--muted); }
    .num { font-size: 12.5px; font-variant-numeric: tabular-nums; }
    .today .num { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--main); color: #fff; font-weight: 600; }
    .item { font: inherit; font-size: 12px; text-align: left; padding: 2px 6px; border: 0; border-radius: 4px; cursor: pointer; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; background: var(--tone-info-bg); color: var(--tone-info-fg); }
    .item[data-tone='bad'] { background: var(--tone-bad-bg); color: var(--tone-bad-fg); }
    .item[data-tone='warn'] { background: var(--tone-warn-bg); color: var(--tone-warn-fg); }
    .item.closed { background: var(--tone-neutral-bg); color: var(--muted); text-decoration: line-through; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthGridComponent {
  readonly month = input.required<string>();
  readonly deadlines = input.required<readonly Deadline[]>();
  readonly open = output<Deadline>();

  protected readonly days = DAYS;
  protected readonly today = todayISO();
  protected readonly weeks = computed(() => monthWeeks(this.month()));
  protected readonly byDay = computed(() => {
    const map = new Map<string, Deadline[]>();
    for (const d of this.deadlines()) map.set(d.dueOn, [...(map.get(d.dueOn) ?? []), d]);
    return map;
  });
  protected readonly tone = (d: Deadline) => whenInfo(d).tone;
}
