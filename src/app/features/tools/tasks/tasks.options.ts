import { PHASES } from '../../../core/data/phases.data';
import { SelectOption } from '../../../shared/ui';
import { TASK_OWNERS, TASK_PRIORITIES } from './tasks.model';

/** Static <select> options for the Tasks tool. Goal and month options are dynamic (see TasksStore). */

export const OWNER_OPTIONS: readonly SelectOption[] = TASK_OWNERS.map((o) => ({ value: o, label: o }));

export const OWNER_FILTER_OPTIONS: readonly SelectOption[] = [
  { value: '', label: 'All owners' },
  ...OWNER_OPTIONS,
];

export const PRIORITY_OPTIONS: readonly SelectOption[] = TASK_PRIORITIES.map((p) => ({ value: p, label: p }));

export const PHASE_OPTIONS: readonly SelectOption[] = PHASES.map((p) => ({ value: p.id, label: p.name }));
