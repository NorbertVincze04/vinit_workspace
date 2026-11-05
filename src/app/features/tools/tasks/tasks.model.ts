import { Phase, PhaseId } from '../../../core/models';

export const TASK_OWNERS = ['Founder', 'Marketing & Sales', 'Both', 'Unassigned'] as const;
export type TaskOwner = (typeof TASK_OWNERS)[number];

export const TASK_PRIORITIES = ['High', 'Medium', 'Low'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Filter value meaning "tasks without a (valid) goal". */
export const NO_GOAL = '__none';

export interface Goal {
  id: string;
  name: string;
  target: string;
}

export interface Task {
  id: string;
  text: string;
  /** Goal id, or '' for no goal. */
  goal: string;
  owner: TaskOwner;
  prio: TaskPriority;
  /** Plan month 1–12. */
  due: number;
  phase: PhaseId;
  done: boolean;
  notes: string;
}

export type TaskPatch = Partial<Omit<Task, 'id'>>;

/** Everything that is saved / exported. */
export interface TasksState {
  /** Calendar month of plan month 1, "YYYY-MM". Only in backups/seed; the live value is in PlanCalendarService. */
  start?: string;
  goals: Goal[];
  tasks: Task[];
}

export interface TaskFilters {
  q: string;
  goal: string;
  owner: string;
  hideDone: boolean;
}

/** A task plus the display info derived from goals and the plan start. */
export interface TaskView {
  task: Task;
  goalTag: string;
  dueLabel: string;
  overdue: boolean;
}

export interface TaskColumn {
  phase: Phase;
  total: number;
  done: number;
  percent: number;
  current: boolean;
  visible: TaskView[];
}

export interface GoalStat {
  goal: Goal;
  done: number;
  total: number;
  percent: number;
}

export function isTasksState(value: unknown): value is TasksState {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  return Array.isArray(o['tasks']) && Array.isArray(o['goals']);
}
