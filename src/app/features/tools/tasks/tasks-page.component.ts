import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PhaseId } from '../../../core/models';
import { downloadJson, readJsonFile } from '../../../core/utils/file';
import {
  PhaseCardComponent,
  PhaseRailComponent,
  ProgressSummaryComponent,
  SaveStatusComponent,
} from '../../../shared/components';
import { ButtonComponent, GridComponent, IconComponent, PageHeaderComponent } from '../../../shared/ui';
import { GoalsPanelComponent } from './components/goals-panel/goals-panel.component';
import { TaskItemComponent } from './components/task-item/task-item.component';
import { TaskToolbarComponent } from './components/task-toolbar/task-toolbar.component';
import { TasksStore } from './tasks.store';

/** Tasks tool: Year-1 goals split into tasks across the four phases. */
@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    ProgressSummaryComponent,
    PhaseRailComponent,
    PhaseCardComponent,
    GridComponent,
    ButtonComponent,
    IconComponent,
    TaskToolbarComponent,
    TaskItemComponent,
    GoalsPanelComponent,
    SaveStatusComponent,
  ],
  templateUrl: './tasks-page.component.html',
  styleUrl: './tasks-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksPageComponent {
  protected readonly store = inject(TasksStore);

  /** Ids of tasks whose details panel is open (UI state only, not saved). */
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected readonly newTaskId = signal<string | null>(null);
  protected readonly importError = signal('');

  protected readonly hint = computed(() => {
    const overdue = this.store.overdueCount();
    return (
      `Month 1 = ${this.store.monthLabel(1)}. ` +
      (overdue ? `${overdue} overdue. ` : '') +
      `Showing ${this.store.shownCount()} of ${this.store.overall().total} tasks.`
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

  protected exportBackup(): void {
    downloadJson(this.store.snapshot(), 'vinit-tasks-backup.json');
  }

  protected async importBackup(file: File): Promise<void> {
    try {
      const ok = this.store.importState(await readJsonFile(file));
      this.importError.set(ok ? '' : 'That file is not a valid VINIT tasks backup.');
      if (ok) this.expanded.set(new Set());
    } catch {
      this.importError.set('That file is not a valid VINIT tasks backup.');
    }
  }

  protected reset(): void {
    this.store.reset();
    this.expanded.set(new Set());
    this.importError.set('');
  }
}
