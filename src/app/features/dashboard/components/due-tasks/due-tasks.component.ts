import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BadgeComponent, CheckboxComponent, PanelComponent } from '../../../../shared/ui';
import { TasksStore } from '../../../tools/tasks/tasks.store';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { t } from '../../../../core/i18n/i18n';
import { TcPipe } from '../../../../core/i18n/tc.pipe';

const LIMIT = 6;

/** Open tasks due by the current plan month; tick them off without leaving the overview. */
@Component({
  selector: 'app-due-tasks',
  standalone: true,
  imports: [TcPipe, TPipe, RouterLink, PanelComponent, CheckboxComponent, BadgeComponent],
  template: `
    <app-panel heading="Tasks due" [meta]="meta()" [flush]="true">
      <a panelAction routerLink="/tools/tasks">{{ 'All tasks' | t }}</a>
      @if (shown().length) {
        <ul>
          @for (view of shown(); track view.task.id) {
            <li>
              <app-checkbox [ariaLabel]="'Mark done: {task}' | t: { task: (view.task.text | tc) }" (checkedChange)="complete(view.task.id, $event)" />
              <span class="text">{{ (view.task.text | tc) || ('Untitled task' | t) }}</span>
              <span class="meta">
                <app-badge [variant]="view.overdue ? 'danger' : 'outline'">
                  {{ view.overdue ? ('Overdue' | t) + ' · ' : '' }}{{ view.dueLabel }}
                </app-badge>
                @if (view.task.prio === 'High') {
                  <app-badge variant="danger">{{ 'High' | t }}</app-badge>
                }
              </span>
            </li>
          }
        </ul>
        @if (more()) {
          <a class="more" routerLink="/tools/tasks">{{ '+{n} more due' | t: { n: more() } }}</a>
        }
      } @else {
        <p class="empty">{{ 'Nothing due right now.' | t }}</p>
      }
    </app-panel>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    app-panel { height: 100%; }
    ul { list-style: none; padding: 0; }
    li { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; align-items: start; gap: 10px;
      padding: 10px 18px; border-top: 1px solid var(--line); }
    li:first-child { border-top: 0; }
    .text { font-size: 14px; line-height: 1.4; overflow-wrap: anywhere; }
    .meta { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
    .more { display: block; padding: 10px 18px; font-size: 13px; color: var(--main); text-decoration: none;
      border-top: 1px solid var(--line); }
    .more:hover { text-decoration: underline; }
    .empty { padding: 24px 18px; color: var(--muted); }
    @media (max-width: 560px) {
      li { grid-template-columns: 20px minmax(0, 1fr); }
      .meta { grid-column: 2; justify-content: flex-start; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DueTasksComponent {
  private readonly store = inject(TasksStore);

  protected readonly shown = computed(() => this.store.dueNow().slice(0, LIMIT));
  protected readonly more = computed(() => Math.max(0, this.store.dueNow().length - LIMIT));
  protected readonly meta = computed(() => {
    const month = this.store.currentMonth();
    return month < 1 ? t('Before the plan starts') : month > 12 ? t('Year 1 finished') : t('Plan month {month}', { month });
  });

  protected complete(id: string, done: boolean): void {
    if (done) this.store.updateTask(id, { done: true });
  }
}
