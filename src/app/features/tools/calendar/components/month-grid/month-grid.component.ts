import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { formatDate, todayISO } from '../../../../../core/utils/date';
import { Deadline, monthWeeks, whenInfo } from '../../calendar.model';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Month calendar (Monday first) with each day's deadlines. Tap a deadline to open it, or a day to pick
 * it (the page adds a deadline there, or on phones lists that day). Done = green and ticked off;
 * dismissed = faded and dashed. On phones the deadlines shrink to coloured dots.
 */
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
          <div class="day" role="gridcell" [class.other]="day.slice(0, 7) !== month()" [class.today]="day === today" [class.selected]="day === selected()" (click)="pick.emit(day)">
            <button type="button" class="num" [attr.aria-label]="label(day)" (click)="pick.emit(day); $event.stopPropagation()">
              {{ +day.slice(8) }}
            </button>
            <span class="items">
            @for (d of byDay().get(day) ?? []; track d.id) {
              <button
                type="button"
                class="item"
                [attr.data-tone]="tone(d)"
                [attr.data-status]="d.status"
                [attr.aria-label]="d.title + ', ' + statusText(d)"
                (click)="open.emit(d); $event.stopPropagation()"
              >
                @if (d.status === 'done') {
                  <span aria-hidden="true">✓ </span>
                }
                @if (!d.allDay && d.dueTime) {
                  <span class="t">{{ d.dueTime }}</span>
                }
                {{ d.title }}
              </button>
            }
            </span>
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
      align-content: start; gap: 3px; min-width: 0; cursor: pointer; }
    .day:hover { background: var(--hover); }
    .day:nth-child(7n + 7) { border-right: 0; }
    .day.other { background: var(--hover); }
    .day.other .num { color: var(--muted); }
    .num { justify-self: start; display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 3px; font: inherit;
      font-size: 12.5px; font-variant-numeric: tabular-nums; color: inherit; background: none; border: 0; border-radius: 11px; cursor: pointer; }
    .num:hover { background: var(--line); }
    .today .num { background: var(--main); color: #fff; font-weight: 600; }
    .item { font: inherit; font-size: 12px; text-align: left; padding: 2px 6px; border: 1px solid transparent; border-radius: 4px; cursor: pointer;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: var(--tone-info-bg); color: var(--tone-info-fg); }
    .t { font-variant-numeric: tabular-nums; font-weight: 600; margin-right: 3px; }
    .item[data-tone='bad'] { background: var(--tone-bad-bg); color: var(--tone-bad-fg); }
    .item[data-tone='warn'] { background: var(--tone-warn-bg); color: var(--tone-warn-fg); }
    /* Done: finished, ticked off. Dismissed: no longer relevant, faded with a dashed outline. */
    .item[data-status='done'] { background: var(--tone-ok-bg); color: var(--tone-ok-fg); text-decoration: line-through; }
    .item[data-status='dismissed'] { background: transparent; color: var(--muted); border: 1px dashed var(--line); font-style: italic; opacity: 0.8; }
    .items { display: contents; }
    .selected { box-shadow: inset 0 0 0 2px var(--main); }
    /* Phones: compact days, deadlines as dots; a tap anywhere on a day picks it. */
    @media (max-width: 720px) {
      .head { padding: 6px 0; font-size: 11px; }
      .day { min-height: 52px; padding: 4px 2px; justify-items: center; gap: 3px; }
      .num { justify-self: center; height: 24px; pointer-events: none; }
      .items { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px; max-width: 100%; }
      .item { width: 7px; height: 7px; padding: 0; font-size: 0; border: 0; border-radius: 50%; pointer-events: none; background: var(--tone-info-fg); }
      .item .t, .item span { display: none; }
      .item[data-tone='bad'] { background: var(--tone-bad-fg); }
      .item[data-tone='warn'] { background: var(--tone-warn-fg); }
      .item[data-status='done'] { background: var(--tone-ok-fg); }
      .item[data-status='dismissed'] { background: transparent; border: 1px solid var(--muted); opacity: 1; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthGridComponent {
  readonly month = input.required<string>();
  readonly deadlines = input.required<readonly Deadline[]>();
  readonly open = output<Deadline>();
  /** Highlighted day (phones). */
  readonly selected = input<string | null>(null);
  /** A day was tapped. */
  readonly pick = output<string>();

  protected readonly days = DAYS;
  protected readonly today = todayISO();
  protected readonly weeks = computed(() => monthWeeks(this.month()));
  protected readonly byDay = computed(() => {
    const map = new Map<string, Deadline[]>();
    for (const d of this.deadlines()) map.set(d.dueOn, [...(map.get(d.dueOn) ?? []), d]);
    return map;
  });
  protected readonly tone = (d: Deadline) => whenInfo(d).tone;
  protected readonly statusText = (d: Deadline) => whenInfo(d).text;
  protected readonly label = (day: string) => formatDate(day, { weekday: 'long', day: 'numeric', month: 'long' });
}
