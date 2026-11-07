import { Injectable, computed, inject, signal } from '@angular/core';
import { PHASES } from '../../../core/data/phases.data';
import { PhaseId, PhaseProgress } from '../../../core/models';
import { PlanCalendarService } from '../../../core/services/plan-calendar.service';
import { isMonthKey } from '../../../core/utils/date';
import { percent } from '../../../core/utils/format';
import { matchesSearch } from '../../../core/utils/text';
import { uid } from '../../../core/utils/id';
import { persistedSignal } from '../../../core/utils/persisted-signal';
import { SelectOption } from '../../../shared/ui';
import {
  GoalStat,
  NO_GOAL,
  Task,
  TaskColumn,
  TaskFilters,
  TaskPatch,
  TasksState,
  TaskView,
  isTasksState,
} from './tasks.model';
import { TASKS_SEED } from './tasks.seed';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * State + derived views for the Tasks tool.
 * Saved in localStorage under "vinit.tasks.v1"; filters are session-only.
 * The plan start month lives in the shared PlanCalendarService.
 */
@Injectable({ providedIn: 'root' })
export class TasksStore {
  private readonly plan = inject(PlanCalendarService);
  private readonly state = persistedSignal<TasksState>('tasks.v1', () => clone(TASKS_SEED), {
    validate: isTasksState,
  });

  readonly filters = signal<TaskFilters>({ q: '', goal: '', owner: '', hideDone: false });

  readonly goals = computed(() => this.state().goals);
  readonly start = this.plan.start.asReadonly();

  /** Plan month number of today (1 = start month). */
  readonly currentMonth = this.plan.currentMonth;

  readonly goalOptions = computed<SelectOption[]>(() => [
    ...this.goals().map((g) => ({ value: g.id, label: g.name })),
    { value: '', label: 'No goal' },
  ]);

  readonly goalFilterOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All goals' },
    ...this.goals().map((g) => ({ value: g.id, label: g.name })),
    { value: NO_GOAL, label: 'No goal' },
  ]);

  readonly monthOptions = computed<SelectOption[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `M${i + 1} · ${this.monthLabel(i + 1)}` })),
  );

  readonly columns = computed<TaskColumn[]>(() => {
    const tasks = this.state().tasks;
    let currentFound = false;

    return PHASES.map((phase) => {
      const all = tasks.filter((t) => t.phase === phase.id);
      const done = all.filter((t) => t.done).length;
      const current = !currentFound && done < all.length;
      if (current) currentFound = true;

      const visible = all
        .filter((t) => this.matches(t))
        .sort((a, b) => a.due - b.due)
        .map((t) => this.toView(t));

      return { phase, total: all.length, done, percent: percent(done, all.length), current, visible };
    });
  });

  readonly overall = computed(() => {
    const tasks = this.state().tasks;
    const done = tasks.filter((t) => t.done).length;
    return { done, total: tasks.length, percent: percent(done, tasks.length) };
  });

  readonly bands = computed<PhaseProgress[]>(() =>
    this.columns().map((c) => ({ name: c.phase.name, percent: c.percent })),
  );

  readonly shownCount = computed(() => this.columns().reduce((sum, c) => sum + c.visible.length, 0));

  /**
   * Open tasks due by the current plan month (or Month 1 before the plan starts),
   * most urgent first: earliest due month, then priority.
   */
  readonly dueNow = computed<TaskView[]>(() => {
    const horizon = Math.max(this.currentMonth(), 1);
    const rank: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    return this.state()
      .tasks.filter((t) => !t.done && t.due <= horizon)
      .sort((a, b) => a.due - b.due || (rank[a.prio] ?? 1) - (rank[b.prio] ?? 1))
      .map((t) => this.toView(t));
  });

  readonly overdueCount = computed(
    () => this.state().tasks.filter((t) => !t.done && t.due < this.currentMonth()).length,
  );

  readonly goalStats = computed<GoalStat[]>(() => {
    const tasks = this.state().tasks;
    return this.goals().map((goal) => {
      const mine = tasks.filter((t) => t.goal === goal.id);
      const done = mine.filter((t) => t.done).length;
      return { goal, done, total: mine.length, percent: percent(done, mine.length) };
    });
  });

  /** "Dec 2026" for plan month n. */
  monthLabel(n: number): string {
    return this.plan.monthLabel(n);
  }

  // ---- Tasks ----

  addTask(phaseId: PhaseId): string {
    const phase = PHASES.find((p) => p.id === phaseId) ?? PHASES[0];
    const f = this.filters();
    const task: Task = {
      id: uid('t'),
      text: '',
      goal: f.goal && f.goal !== NO_GOAL ? f.goal : '',
      owner: (f.owner || 'Founder') as Task['owner'],
      prio: 'Medium',
      due: phase.months[1],
      phase: phase.id,
      done: false,
      notes: '',
    };
    this.state.update((s) => ({ ...s, tasks: [...s.tasks, task] }));
    return task.id;
  }

  updateTask(id: string, patch: TaskPatch): void {
    this.state.update((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }

  deleteTask(id: string): void {
    this.state.update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  }

  // ---- Goals ----

  addGoal(): void {
    this.state.update((s) => ({ ...s, goals: [...s.goals, { id: uid('g'), name: 'New goal', target: '' }] }));
  }

  updateGoal(id: string, patch: Partial<{ name: string; target: string }>): void {
    this.state.update((s) => ({
      ...s,
      goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  }

  /** Removes a goal; its tasks become "No goal". */
  deleteGoal(id: string): void {
    this.state.update((s) => ({
      ...s,
      goals: s.goals.filter((g) => g.id !== id),
      tasks: s.tasks.map((t) => (t.goal === id ? { ...t, goal: '' } : t)),
    }));
    if (this.filters().goal === id) this.setFilters({ goal: '' });
  }

  // ---- Settings, filters, backups ----

  /** Changes Month 1 for every tool (shared plan calendar). */
  setStart(value: string): void {
    this.plan.setStart(value);
  }

  setFilters(patch: Partial<TaskFilters>): void {
    this.filters.update((f) => ({ ...f, ...patch }));
  }

  /** Backup content: goals, tasks and the plan start month. */
  snapshot(): TasksState {
    return { ...clone(this.state()), start: this.plan.start() };
  }

  /** Replaces everything with a backup. Returns false if the data is not a valid backup. */
  importState(data: unknown): boolean {
    if (!isTasksState(data)) return false;
    const { start, ...rest } = clone(data);
    this.state.set(rest);
    if (isMonthKey(start)) this.plan.setStart(start);
    return true;
  }

  reset(): void {
    const { start: _start, ...seed } = clone(TASKS_SEED);
    this.state.set(seed);
  }

  // ---- helpers ----

  private matches(t: Task): boolean {
    const f = this.filters();
    if (f.hideDone && t.done) return false;
    if (f.goal === NO_GOAL) {
      if (this.goals().some((g) => g.id === t.goal)) return false;
    } else if (f.goal && t.goal !== f.goal) {
      return false;
    }
    if (f.owner && t.owner !== f.owner) return false;
    return matchesSearch(f.q, t.text, t.notes);
  }

  private toView(task: Task): TaskView {
    const goal = this.goals().find((g) => g.id === task.goal);
    return {
      task,
      goalTag: goal ? goal.name.split(' – ')[0] : 'No goal',
      dueLabel: this.monthLabel(task.due),
      overdue: !task.done && task.due < this.currentMonth(),
    };
  }
}
