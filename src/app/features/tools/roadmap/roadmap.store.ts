import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService, apiError } from '../../../core/api/api.service';
import { BREAK_EVEN_SALONS, FINANCE, YEAR1_MRR } from '../../../core/data/finance.data';
import { PhaseProgress } from '../../../core/models';
import { ToastService } from '../../../core/services/toast.service';
import { clamp, percent } from '../../../core/utils/format';

export const MAX_SALONS = 500;

export const GOAL_KEYS = [
  'payingSalons',
  'breakEvenSalons',
  'mrrBani',
  'incomeBani',
  'monthlyCostsBani',
  'retentionPct',
  'onboardingHours',
  'smsMonthlyBudget',
  'operationalCostsBani',
] as const;
export type GoalKey = (typeof GOAL_KEYS)[number];
export type Goals = Record<GoalKey, number | null>;

export interface PlanStep {
  id: string;
  text: string;
  position: number;
  done: boolean;
}

export interface PlanPhase {
  id: string;
  key: string | null;
  name: string;
  monthFrom: number;
  monthTo: number;
  goal: string;
  milestone: string;
  position: number;
  steps: PlanStep[];
}

/** GET /plan/years item. */
export interface PlanYear {
  year: number;
  from: string;
  to: string;
  status: 'past' | 'current' | 'future';
  /** What was set (null = not set). */
  goals: Goals;
  /** In force: unset goals fall back to the previous year, then the built-in plan. */
  effective: Goals;
  notes: string;
  phases: PlanPhase[];
}

/** GET /plan/years/:year/results. */
export interface YearResults {
  year: number;
  from: string;
  to: string;
  months: number;
  actual: {
    payingSalons: number;
    mrrBani: number;
    incomeBani: number;
    monthlyCostsBani: number | null;
    retentionPct: number | null;
    onboardingHours: number | null;
    smsMonthlyMax: number;
  };
  steps: { done: number; total: number };
  newPaying: number;
  churned: number;
}

export interface RoadmapPhaseView {
  /** What <app-phase-card> shows. */
  phase: { id: string; name: string; months: readonly [number, number]; goal: string };
  source: PlanPhase;
  steps: PlanStep[];
  milestone: string;
  done: number;
  total: number;
  percent: number;
  current: boolean;
}

/** Backup / old-browser format: ticked step ids and the old manual counter. */
export interface RoadmapState {
  done: Record<string, boolean>;
  salons: number;
}

const isRoadmapState = (v: unknown): v is RoadmapState => {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o['salons'] === 'number' && typeof o['done'] === 'object' && o['done'] !== null;
};

/** The business plan's Year 1, used until the server answers. */
const BUILT_IN: Goals = {
  payingSalons: FINANCE.year1Salons,
  breakEvenSalons: BREAK_EVEN_SALONS,
  mrrBani: YEAR1_MRR * 100,
  incomeBani: null,
  monthlyCostsBani: FINANCE.monthlyCosts * 100,
  retentionPct: 70,
  onboardingHours: 48,
  smsMonthlyBudget: 1500,
  operationalCostsBani: FINANCE.monthlyOperational * 100,
};

/** Phases of a year with their steps and progress; the first unfinished one is "current". */
export function phaseViews(year: PlanYear | undefined): RoadmapPhaseView[] {
  let currentFound = false;
  return (year?.phases ?? []).map((p) => {
    const done = p.steps.filter((s) => s.done).length;
    const current = year?.status === 'current' && !currentFound && done < p.steps.length;
    if (current) currentFound = true;
    return {
      phase: { id: p.id, name: p.name, months: [p.monthFrom, p.monthTo] as const, goal: p.goal },
      source: p,
      steps: p.steps,
      milestone: p.milestone,
      done,
      total: p.steps.length,
      percent: percent(done, p.steps.length),
      current,
    };
  });
}

/**
 * Year plans: each plan year's goals and roadmap (GET /plan/years). The current year's goals are
 * what the Overview, Subscriptions and the salon counter measure against.
 */
@Injectable({ providedIn: 'root' })
export class RoadmapStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly years = signal<PlanYear[]>([]);
  readonly currentYear = signal(1);
  readonly loaded = signal(false);
  /** The old manual counter (kept for backups only). */
  private readonly manualSalons = signal(0);

  constructor() {
    void this.load();
  }

  readonly current = computed(() => this.years().find((y) => y.year === this.currentYear()));
  /** Goals in force this year. */
  readonly goals = computed<Goals>(() => this.current()?.effective ?? BUILT_IN);
  readonly salons = computed(() => this.manualSalons());

  /** The current year's phases (Overview, Tasks rail). */
  readonly phases = computed(() => phaseViews(this.current()));

  readonly overall = computed(() => {
    const phases = this.phases();
    const done = phases.reduce((sum, p) => sum + p.done, 0);
    const total = phases.reduce((sum, p) => sum + p.total, 0);
    return { done, total, percent: percent(done, total) };
  });

  readonly bands = computed<PhaseProgress[]>(() => this.phases().map((p) => ({ name: p.phase.name, percent: p.percent })));

  async load(): Promise<void> {
    try {
      const [plan, state] = await Promise.all([
        this.api.get<{ currentYear: number; items: PlanYear[] }>('/plan/years'),
        this.api.get<RoadmapState>('/roadmap').catch(() => null),
      ]);
      this.years.set(plan.items);
      this.currentYear.set(plan.currentYear);
      if (state && isRoadmapState(state)) this.manualSalons.set(state.salons);
      this.loaded.set(true);
    } catch {
      /* the interceptor handles 401; otherwise the page shows what it has */
    }
  }

  results(year: number): Promise<YearResults> {
    return this.api.get<YearResults>(`/plan/years/${year}/results`);
  }

  // ---- ticks ----

  setStep(id: string, isDone: boolean): void {
    this.years.update((ys) => ys.map((y) => ({ ...y, phases: y.phases.map((p) => ({ ...p, steps: p.steps.map((s) => (s.id === id ? { ...s, done: isDone } : s)) })) })));
    this.api.write('PUT', `/roadmap/steps/${encodeURIComponent(id)}`, { done: isDone }).catch((error: unknown) => {
      this.toast.show(`Not saved: ${apiError(error).message}`, 6000);
      void this.load();
    });
  }

  // ---- editing (each saves, then reloads) ----

  addYear(): Promise<PlanYear | null> {
    return this.run(async () => (await this.api.write<{ item: PlanYear }>('POST', '/plan/years')).item, 'Year added');
  }

  updateGoals(year: number, patch: Partial<Goals> & { notes?: string }): Promise<unknown> {
    return this.run(() => this.api.write('PATCH', `/plan/years/${year}`, patch), 'Goals saved');
  }

  deleteYear(year: number): Promise<unknown> {
    return this.run(() => this.api.write('DELETE', `/plan/years/${year}`), `Year ${year} removed`);
  }

  addPhase(year: number, body: Partial<PlanPhase>): Promise<unknown> {
    return this.run(() => this.api.write('POST', `/plan/years/${year}/phases`, body), 'Phase added');
  }

  updatePhase(id: string, patch: Partial<PlanPhase>): Promise<unknown> {
    return this.run(() => this.api.write('PATCH', `/plan/phases/${id}`, patch), 'Phase saved');
  }

  deletePhase(id: string): Promise<unknown> {
    return this.run(() => this.api.write('DELETE', `/plan/phases/${id}`), 'Phase removed');
  }

  addStep(phaseId: string, text: string): Promise<unknown> {
    return this.run(() => this.api.write('POST', `/plan/phases/${phaseId}/steps`, { text }));
  }

  updateStep(id: string, text: string): Promise<unknown> {
    return this.run(() => this.api.write('PATCH', `/plan/steps/${encodeURIComponent(id)}`, { text }), 'Step saved');
  }

  deleteStep(id: string): Promise<unknown> {
    return this.run(() => this.api.write('DELETE', `/plan/steps/${encodeURIComponent(id)}`), 'Step removed');
  }

  private async run<T>(action: () => Promise<T>, done?: string): Promise<T | null> {
    try {
      const result = await action();
      if (done) this.toast.show(done);
      await this.load();
      return result;
    } catch (error) {
      this.toast.show(`Not saved: ${apiError(error).message}`, 6000);
      return null;
    }
  }

  // ---- backup (ticks only) ----

  snapshot(): RoadmapState {
    const done: Record<string, boolean> = {};
    for (const y of this.years()) for (const p of y.phases) for (const s of p.steps) if (s.done) done[s.id] = true;
    return { done, salons: this.manualSalons() };
  }

  /** Replaces the ticks with a backup. Returns false if the data is not a valid backup. */
  importState(data: unknown): boolean {
    if (!isRoadmapState(data)) return false;
    const next = { done: { ...data.done }, salons: clamp(Math.round(data.salons), 0, MAX_SALONS) };
    this.api.write('PUT', '/roadmap', next).then(
      () => void this.load(),
      (error: unknown) => this.toast.show(`Not saved: ${apiError(error).message}`, 6000),
    );
    return true;
  }
}
