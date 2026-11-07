import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { PHASES } from '../../../core/data/phases.data';
import { PhaseId, PhaseProgress } from '../../../core/models';
import { PlanCalendarService } from '../../../core/services/plan-calendar.service';
import { isMonthKey } from '../../../core/utils/date';
import { percent } from '../../../core/utils/format';
import { matchesSearch } from '../../../core/utils/text';
import { uid } from '../../../core/utils/id';
import { apiCollection } from '../../../core/api/api-collection';
import { FieldMap, field } from '../../../core/api/api-fields';
import { SelectOption } from '../../../shared/ui';
import {
  Goal,
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

const GOAL_FIELDS: FieldMap<Goal> = { name: field.text(), target: field.text() };

/** Task model ⇄ API: `due` is the plan month (dueMonth), `goal` the goal id ('' = none). */
const TASK_FIELDS: FieldMap<Task> = {
  text: field.text(),
  goal: field.ref('goalId'),
  owner: field.text(),
  prio: field.text(),
  due: field.int('dueMonth'),
  phase: field.text(),
  done: field.bool(),
  notes: field.text(),
};

/**
 * State + derived views for the Tasks tool.
 * Goals and tasks are saved on the server (/api/v1/goals, /api/v1/tasks); filters are session-only.
 * An empty workspace starts with the Year-1 worksheet (TASKS_SEED), like the first visit did before.
 * The plan start month lives in the shared PlanCalendarService.
 */
@Injectable({ providedIn: 'root' })
export class TasksStore {
  private readonly plan = inject(PlanCalendarService);
  private readonly goalList = apiCollection<Goal>('/goals', GOAL_FIELDS, 'g');
  private readonly taskList = apiCollection<Task>('/tasks', TASK_FIELDS, 't');
  private readonly state = computed<TasksState>(() => ({ goals: [...this.goalList.items()], tasks: [...this.taskList.items()] }));
  /** True once goals and tasks have been loaded from the server. */
  readonly loaded = computed(() => this.goalList.loaded() && this.taskList.loaded());

  readonly filters = signal<TaskFilters>({ q: '', goal: '', owner: '', hideDone: false });

  constructor() {
    // A brand-new workspace (successfully loaded, no goals and no tasks) gets the Year-1 worksheet.
    let seeded = false;
    effect(
      () => {
        if (seeded || !this.loaded()) return;
        seeded = true;
        if (!this.goalList.items().length && !this.taskList.items().length) untracked(() => this.reset());
      },
      { allowSignalWrites: true },
    );
  }

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
    const task = this.taskList.add({
      id: uid('t'),
      text: '',
      goal: f.goal && f.goal !== NO_GOAL ? f.goal : '',
      owner: (f.owner || 'Founder') as Task['owner'],
      prio: 'Medium',
      due: phase.months[1],
      phase: phase.id,
      done: false,
      notes: '',
    });
    return task.id;
  }

  updateTask(id: string, patch: TaskPatch): void {
    this.taskList.update(id, patch);
  }

  deleteTask(id: string): void {
    this.taskList.remove(id);
  }

  // ---- Goals ----

  addGoal(): void {
    this.goalList.add({ id: uid('g'), name: 'New goal', target: '' });
  }

  updateGoal(id: string, patch: Partial<{ name: string; target: string }>): void {
    this.goalList.update(id, patch);
  }

  /** Removes a goal; its tasks become "No goal" (the server unlinks them too). */
  deleteGoal(id: string): void {
    this.goalList.remove(id);
    this.taskList.setLocal((tasks) => tasks.map((t) => (t.goal === id ? { ...t, goal: '' } : t)));
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
    const { start, goals, tasks } = clone(data);
    this.replace(goals, tasks);
    if (isMonthKey(start)) this.plan.setStart(start);
    return true;
  }

  reset(): void {
    const { goals, tasks } = clone(TASKS_SEED);
    this.replace(goals, tasks);
  }

  /** Goals first, so the tasks' goal links exist when the tasks arrive (writes stay in order). */
  private replace(goals: Goal[], tasks: Task[]): void {
    void this.goalList.replaceAll(goals).catch(() => undefined);
    void this.taskList.replaceAll(tasks).catch(() => undefined);
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
