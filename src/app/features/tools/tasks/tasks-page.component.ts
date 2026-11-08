import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PhaseId } from '../../../core/models';
import { ToastService } from '../../../core/services/toast.service';
import { BackupMenuComponent, PhaseCardComponent, ProgressSummaryComponent } from '../../../shared/components';
import {
  ButtonComponent,
  ConfirmDialogComponent,
  IconComponent,
  MenuItemComponent,
  PageHeaderComponent,
} from '../../../shared/ui';
import { GoalsPanelComponent } from './components/goals-panel/goals-panel.component';
import { TaskItemComponent } from './components/task-item/task-item.component';
import { TaskToolbarComponent } from './components/task-toolbar/task-toolbar.component';
import { TasksStore } from './tasks.store';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/** Tasks tool: Year-1 goals split into tasks across the four phases. */
@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [TPipe, 
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    MenuItemComponent,
    ConfirmDialogComponent,
    BackupMenuComponent,
    ProgressSummaryComponent,
    PhaseCardComponent,
    TaskToolbarComponent,
    TaskItemComponent,
    GoalsPanelComponent,
  ],
  templateUrl: './tasks-page.component.html',
  styleUrl: './tasks-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksPageComponent {
  protected readonly store = inject(TasksStore);
  private readonly toast = inject(ToastService);

  /** Ids of tasks whose details panel is open (UI state only, not saved). */
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected readonly newTaskId = signal<string | null>(null);
  protected readonly resetting = signal(false);

  protected readonly hint = computed(() => {
    const overdue = this.store.overdueCount();
    return (
      t('Showing {n} of {total} tasks', { n: this.store.shownCount(), total: this.store.overall().total }) +
      (overdue ? ' · ' + t('{n} overdue', { n: overdue }) : '') +
      ' · ' + t('Month 1 = {month}', { month: this.store.monthLabel(1) })
    );
  });

  protected setExpanded(id: string, open: boolean): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected addTask(phaseId: PhaseId): void {
    const id = this.store.addTask(phaseId);
    this.setExpanded(id, true);
    this.newTaskId.set(id);
  }

  protected reset(): void {
    this.store.reset();
    this.expanded.set(new Set());
    this.toast.show('Tasks reset to the plan');
  }
}
