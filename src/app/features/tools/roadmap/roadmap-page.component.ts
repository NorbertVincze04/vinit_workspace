import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { BackupMenuComponent, PhaseCardComponent, ProgressSummaryComponent } from '../../../shared/components';
import {
  ButtonComponent,
  CheckboxComponent,
  ChipGroupComponent,
  ConfirmDialogComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
  IconComponent,
  PageHeaderComponent,
  PanelComponent,
  ProgressBarComponent,
  StatusPillComponent,
  asString,
} from '../../../shared/ui';
import { BillingStore } from '../subscriptions/billing.store';
import { SalonCounterComponent } from './components/salon-counter/salon-counter.component';
import { WeeklyRhythmComponent } from './components/weekly-rhythm/weekly-rhythm.component';
import { PLAN_B } from './roadmap.data';
import { PlanPhase, PlanStep, PlanYear, RoadmapStore, YearResults, phaseViews } from './roadmap.store';
import { GOALS, goalBody, goalFields, goalRows, goalValue, goalValues, phaseBody, phaseFields, phaseValues, yearLabel } from './year-plan.model';

type Form =
  | { kind: 'goals'; year: PlanYear }
  | { kind: 'phase'; year: PlanYear; phase: PlanPhase | null }
  | { kind: 'step'; step: PlanStep };
type Confirm = { kind: 'phase'; phase: PlanPhase } | { kind: 'step'; step: PlanStep } | { kind: 'year'; year: PlanYear };

/**
 * Roadmap: one plan per year — its goals (goal vs. what happened) and its phases with steps.
 * Switch years to see how past years went; "Edit roadmap" changes phases and steps.
 */
@Component({
  selector: 'app-roadmap-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    PanelComponent,
    CheckboxComponent,
    ChipGroupComponent,
    ButtonComponent,
    IconComponent,
    StatusPillComponent,
    ProgressBarComponent,
    FormDialogComponent,
    ConfirmDialogComponent,
    ProgressSummaryComponent,
    PhaseCardComponent,
    BackupMenuComponent,
    SalonCounterComponent,
    WeeklyRhythmComponent,
  ],
  templateUrl: './roadmap-page.component.html',
  styleUrl: './roadmap-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoadmapPageComponent {
  protected readonly store = inject(RoadmapStore);
  /** Paying salons and MRR, live (decision F). */
  protected readonly billing = inject(BillingStore);
  protected readonly planB = PLAN_B;

  /** Year shown ('' until loaded → the current one). */
  protected readonly picked = signal('');
  protected readonly editing = signal(false);
  protected readonly results = signal<YearResults | null>(null);
  protected readonly form = signal<Form | null>(null);
  protected readonly confirm = signal<Confirm | null>(null);
  /** Text typed in each phase's "add step" box. */
  protected readonly drafts = signal<Record<string, string>>({});

  protected readonly yearOptions = computed(() =>
    this.store.years().map((y) => ({ value: String(y.year), label: `Year ${y.year}${y.status === 'current' ? ' · now' : ''}` })),
  );
  protected readonly year = computed(() => {
    const n = Number(this.picked()) || this.store.currentYear();
    return this.store.years().find((y) => y.year === n) ?? this.store.current();
  });
  protected readonly yearValue = computed(() => String(this.year()?.year ?? ''));
  protected readonly phases = computed(() => phaseViews(this.year()));
  protected readonly overall = computed(() => {
    const p = this.phases();
    const done = p.reduce((s, x) => s + x.done, 0);
    const total = p.reduce((s, x) => s + x.total, 0);
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  });
  protected readonly rows = computed(() => {
    const y = this.year();
    return y ? goalRows(y, this.results()) : [];
  });
  protected readonly isLast = computed(() => this.year()?.year === this.store.years().at(-1)?.year);
  protected readonly nextYear = computed(() => (this.store.years().at(-1)?.year ?? 0) + 1);

  protected readonly label = yearLabel;
  protected readonly value = goalValue;
  protected readonly groups = [...new Set(GOALS.map((g) => g.group))];

  constructor() {
    // Results of the shown year (not for a year that hasn't started).
    effect(
      () => {
        const y = this.year();
        untracked(() => {
          this.results.set(null);
          if (y && y.status !== 'future') void this.store.results(y.year).then((r) => this.year()?.year === y.year && this.results.set(r), () => undefined);
        });
      },
      { allowSignalWrites: true },
    );
  }

  protected rowsOf(group: string) {
    return this.rows().filter((r) => r.def.group === group);
  }

  protected goalsMeta(y: PlanYear): string {
    const r = this.results();
    if (y.status === 'past') return 'Final';
    if (!r || r.months === 0) return `Starts ${yearLabel(y).split(' – ')[0]}`;
    return `${r.months} of 12 months so far`;
  }

  protected statusText(y: PlanYear): string {
    return y.status === 'past' ? 'Ended' : y.status === 'current' ? 'This year' : 'Not started';
  }

  // ---- years ----

  protected async addYear(): Promise<void> {
    const y = await this.store.addYear();
    if (y) {
      this.picked.set(String(y.year));
      this.editing.set(true);
    }
  }

  // ---- forms ----

  protected formFields(f: Form): FieldDef[] {
    if (f.kind === 'goals') return goalFields();
    if (f.kind === 'phase') return phaseFields(f.year);
    return [{ key: 'text', label: 'Step', type: 'text', required: true, maxLength: 300, span: 'full' }];
  }

  protected formValues(f: Form): FormValues {
    if (f.kind === 'goals') return goalValues(f.year);
    if (f.kind === 'phase') return f.phase ? phaseValues(f.phase) : {};
    return { text: f.step.text };
  }

  protected formHeading(f: Form): string {
    if (f.kind === 'goals') return `Year ${f.year.year} goals`;
    if (f.kind === 'phase') return f.phase ? `Edit ${f.phase.name}` : 'New phase';
    return 'Edit step';
  }

  protected formSub(f: Form): string {
    return f.kind === 'goals' ? `${yearLabel(f.year)}. Leave a goal empty to keep the one from the year before.` : '';
  }

  protected async saveForm(v: FormValues): Promise<void> {
    const f = this.form();
    if (!f) return;
    if (f.kind === 'goals') await this.store.updateGoals(f.year.year, goalBody(v));
    else if (f.kind === 'phase') await (f.phase ? this.store.updatePhase(f.phase.id, phaseBody(v)) : this.store.addPhase(f.year.year, phaseBody(v)));
    else await this.store.updateStep(f.step.id, asString(v['text']));
  }

  protected async confirmed(c: Confirm): Promise<void> {
    if (c.kind === 'phase') await this.store.deletePhase(c.phase.id);
    else if (c.kind === 'step') await this.store.deleteStep(c.step.id);
    else {
      await this.store.deleteYear(c.year.year);
      this.picked.set('');
    }
  }

  protected confirmText(c: Confirm): { heading: string; message: string } {
    if (c.kind === 'phase') return { heading: `Remove ${c.phase.name}?`, message: `The phase and its ${c.phase.steps.length} steps will be removed.` };
    if (c.kind === 'step') return { heading: 'Remove step?', message: `“${c.step.text}” will be removed.` };
    return { heading: `Remove Year ${c.year.year}?`, message: 'Its goals and roadmap will be removed. It has not started yet.' };
  }

  // ---- steps ----

  protected draft(phaseId: string): string {
    return this.drafts()[phaseId] ?? '';
  }

  protected setDraft(phaseId: string, text: string): void {
    this.drafts.update((d) => ({ ...d, [phaseId]: text }));
  }

  protected async addStep(phaseId: string, event?: Event): Promise<void> {
    event?.preventDefault();
    const text = this.draft(phaseId).trim();
    if (!text) return;
    await this.store.addStep(phaseId, text);
    this.setDraft(phaseId, '');
  }
}
