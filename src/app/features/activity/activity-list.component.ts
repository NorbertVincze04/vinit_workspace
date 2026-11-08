import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivityEntry, activityLabel, activityLink } from '../../core/data/activity.data';
import { formatDate, todayISO } from '../../core/utils/date';
import { locale, t } from '../../core/i18n/i18n';
import { TPipe } from '../../core/i18n/t.pipe';
import { translateServer } from '../../core/i18n/server-messages';

/** Activity entries grouped by day: time, what happened (linked), who. */
@Component({
  selector: 'app-activity-list',
  standalone: true,
  imports: [TPipe, RouterLink],
  template: `
    @for (day of days(); track day.date) {
      @if (showDays()) {
        <h3 class="day">{{ day.label }}</h3>
      }
      <ul>
        @for (a of day.items; track a.id) {
          <li>
            <span class="time">{{ time(a.occurredAt) }}</span>
            <a class="what" [routerLink]="link(a).route" [queryParams]="link(a).query ?? null">
              <span class="summary">{{ summary(a) || label(a) }}</span>
              <span class="sub">{{ label(a) }}{{ a.salonName && !a.summary.includes(a.salonName) ? ' · ' + a.salonName : '' }}</span>
            </a>
            <span class="who">{{ a.userName || ('System' | t) }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; }
    .day { font-size: 12.5px; font-weight: 600; color: var(--muted); margin: 14px 0 6px; }
    .day:first-child { margin-top: 0; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
    li { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; gap: 10px; align-items: baseline; padding: 6px 0; font-size: 14px; }
    .time { color: var(--muted); font-size: 12.5px; font-variant-numeric: tabular-nums; }
    .what { display: grid; min-width: 0; color: inherit; text-decoration: none; }
    .what:hover .summary { color: var(--main); text-decoration: underline; }
    .summary { overflow-wrap: anywhere; }
    .sub { font-size: 12.5px; color: var(--muted); }
    .who { font-size: 12.5px; color: var(--muted); white-space: nowrap; }
    @media (max-width: 520px) { li { grid-template-columns: 44px minmax(0, 1fr); } .who { grid-column: 2; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityListComponent {
  readonly items = input.required<readonly ActivityEntry[]>();
  readonly showDays = input(true);

  protected readonly label = activityLabel;
  /** The server writes summaries in English: the common ones are translated. */
  protected readonly summary = (a: ActivityEntry): string => translateServer(a.summary);
  protected readonly link = activityLink;
  protected readonly time = (iso: string) => new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

  protected readonly days = computed(() => {
    const today = todayISO();
    const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE');
    const groups: { date: string; label: string; items: ActivityEntry[] }[] = [];
    for (const a of this.items()) {
      const date = new Date(a.occurredAt).toLocaleDateString('sv-SE');
      let g = groups.at(-1);
      if (!g || g.date !== date) {
        g = { date, label: date === today ? t('Today') : date === yesterday ? t('Yesterday') : formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' }), items: [] };
        groups.push(g);
      }
      g.items.push(a);
    }
    return groups;
  });
}
