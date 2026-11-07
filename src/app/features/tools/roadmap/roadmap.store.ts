import { Injectable, computed } from '@angular/core';
import { PHASES } from '../../../core/data/phases.data';
import { Phase, PhaseProgress } from '../../../core/models';
import { clamp, percent } from '../../../core/utils/format';
import { persistedSignal } from '../../../core/utils/persisted-signal';
import { ROADMAP_PLAN } from './roadmap.data';

export const MAX_SALONS = 500;

export interface RoadmapState {
  done: Record<string, boolean>;
  salons: number;
}

export interface RoadmapStepView {
  id: string;
  text: string;
  done: boolean;
}

export interface RoadmapPhaseView {
  phase: Phase;
  steps: RoadmapStepView[];
  milestone: string;
  done: number;
  total: number;
  percent: number;
  current: boolean;
}

const isRoadmapState = (v: unknown): v is RoadmapState => {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o['salons'] === 'number' && typeof o['done'] === 'object' && o['done'] !== null;
};

/** State + derived views for the Roadmap tool. Saved in localStorage under "vinit.roadmap.v1". */
@Injectable({ providedIn: 'root' })
export class RoadmapStore {
  private readonly state = persistedSignal<RoadmapState>('roadmap.v1', () => ({ done: {}, salons: 0 }), {
    validate: isRoadmapState,
  });

  readonly salons = computed(() => this.state().salons);

  readonly phases = computed<RoadmapPhaseView[]>(() => {
    const done = this.state().done;
    let currentFound = false;

    return PHASES.map((phase) => {
      const plan = ROADMAP_PLAN.find((p) => p.phaseId === phase.id);
      const steps = (plan?.steps ?? []).map((s) => ({ ...s, done: !!done[s.id] }));
      const doneCount = steps.filter((s) => s.done).length;
      const current = !currentFound && doneCount < steps.length;
      if (current) currentFound = true;

      return {
        phase,
        steps,
        milestone: plan?.milestone ?? '',
        done: doneCount,
        total: steps.length,
        percent: percent(doneCount, steps.length),
        current,
      };
    });
  });

  readonly overall = computed(() => {
    const phases = this.phases();
    const done = phases.reduce((sum, p) => sum + p.done, 0);
    const total = phases.reduce((sum, p) => sum + p.total, 0);
    return { done, total, percent: percent(done, total) };
  });

  readonly bands = computed<PhaseProgress[]>(() =>
    this.phases().map((p) => ({ name: p.phase.name, percent: p.percent })),
  );

  setStep(id: string, isDone: boolean): void {
    this.state.update((s) => {
      const done = { ...s.done };
      if (isDone) done[id] = true;
      else delete done[id];
      return { ...s, done };
    });
  }

  setSalons(count: number): void {
    this.state.update((s) => ({ ...s, salons: clamp(Math.round(count), 0, MAX_SALONS) }));
  }

  snapshot(): RoadmapState {
    return { done: { ...this.state().done }, salons: this.state().salons };
  }

  /** Replaces progress with a backup. Returns false if the data is not a valid backup. */
  importState(data: unknown): boolean {
    if (!isRoadmapState(data)) return false;
    this.state.set({ done: { ...data.done }, salons: clamp(Math.round(data.salons), 0, MAX_SALONS) });
    return true;
  }
}
