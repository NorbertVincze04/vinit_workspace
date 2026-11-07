import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ToastService } from '../../../../../core/services/toast.service';
import { formatDateTime, fromLocalDateTime, toLocalDateTime } from '../../../../../core/utils/date';
import {
  ButtonComponent,
  CheckboxComponent,
  Fact,
  FactsComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
  MenuComponent,
  MenuItemComponent,
  MeterComponent,
  PanelComponent,
  StatusPillComponent,
  asString,
} from '../../../../../shared/ui';
import { ONBOARDING_HOURS, Onboarding, OnboardingStep, STEP_CATEGORIES, StepCategory, clockOf, statusOf } from '../../onboarding.model';
import { OnboardingStore } from '../../onboarding.store';

type Dialog = { kind: 'materials' | 'live' | 'block' | 'signed'; fields: FieldDef[]; values: FormValues };

const nowLocal = (): string => toLocalDateTime(new Date().toISOString());

/** The salon's onboarding: the 48h clock, the checklist by category, and going live. */
@Component({
  selector: 'app-onboarding-checklist',
  standalone: true,
  imports: [PanelComponent, FactsComponent, MeterComponent, StatusPillComponent, CheckboxComponent, ButtonComponent, MenuComponent, MenuItemComponent, FormDialogComponent],
  templateUrl: './onboarding-checklist.component.html',
  styleUrl: './onboarding-checklist.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingChecklistComponent {
  readonly onboarding = input.required<Onboarding>();
  readonly changed = output<Onboarding>();

  private readonly store = inject(OnboardingStore);
  private readonly toast = inject(ToastService);

  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly newStep = signal('');
  protected readonly newCategory = signal<StepCategory>('setup');
  protected readonly busy = signal(false);
  protected readonly categories = STEP_CATEGORIES;
  protected readonly hours = ONBOARDING_HOURS;

  protected readonly clock = computed(() => clockOf(this.onboarding()));
  protected readonly status = computed(() => statusOf(this.onboarding()));
  protected readonly groups = computed(() =>
    STEP_CATEGORIES.map((c) => ({ ...c, steps: (this.onboarding().steps ?? []).filter((s) => s.category === c.value) })).filter((g) => g.steps.length),
  );
  protected readonly facts = computed<Fact[]>(() => {
    const o = this.onboarding();
    return [
      { label: 'Signed', value: formatDateTime(o.signedAt) },
      {
        label: 'Materials received',
        value: o.materialsReceivedAt ? formatDateTime(o.materialsReceivedAt) : 'Not yet',
        hint: o.materialsReceivedAt ? `the ${ONBOARDING_HOURS}h clock started` : 'the clock starts when they arrive',
      },
      { label: `Live by (${ONBOARDING_HOURS}h)`, value: formatDateTime(o.targetLiveAt) },
      { label: 'Went live', value: formatDateTime(o.wentLiveAt) },
      { label: 'Checklist', value: `${o.stepsDone} of ${o.stepsTotal} done` },
    ];
  });

  // ---- steps ----

  protected async toggle(step: OnboardingStep, done: boolean): Promise<void> {
    await this.run(() => this.store.setStep(step.id, { done }));
  }

  protected async removeStep(step: OnboardingStep): Promise<void> {
    await this.run(() => this.store.removeStep(step.id), `Removed “${step.title}”`);
  }

  protected async addStep(): Promise<void> {
    const title = this.newStep().trim();
    if (!title) return;
    await this.run(() => this.store.addStep(this.onboarding().id, { title, category: this.newCategory() }));
    this.newStep.set('');
  }

  protected onInput(event: Event): void {
    this.newStep.set((event.target as HTMLInputElement).value);
  }

  protected onCategory(event: Event): void {
    this.newCategory.set((event.target as HTMLSelectElement).value as StepCategory);
  }

  // ---- dialogs ----

  protected open(kind: Dialog['kind']): void {
    const o = this.onboarding();
    const when = (label: string, value: string | null): FieldDef => ({ key: 'at', label, type: 'datetime', required: true, default: value ? toLocalDateTime(value) : nowLocal() });
    const dialogs: Record<Dialog['kind'], Dialog> = {
      materials: { kind, fields: [when('Materials arrived at', o.materialsReceivedAt)], values: {} },
      live: { kind, fields: [when('Went live at', null)], values: {} },
      signed: { kind, fields: [when('Signed at', o.signedAt)], values: {} },
      block: {
        kind,
        fields: [{ key: 'reason', label: 'What blocks it?', type: 'textarea', required: true, maxLength: 1000, span: 'full', placeholder: 'e.g. Waiting for the domain transfer' }],
        values: {},
      },
    };
    this.dialog.set(dialogs[kind]);
  }

  protected readonly titles: Record<Dialog['kind'], string> = {
    materials: 'Materials received',
    live: 'Go live',
    signed: 'Signed at',
    block: 'Blocked',
  };

  protected async saved(v: FormValues): Promise<void> {
    const d = this.dialog();
    const o = this.onboarding();
    if (!d) return;
    const at = fromLocalDateTime(asString(v['at']));
    switch (d.kind) {
      case 'materials':
        await this.run(() => this.store.update(o.id, { materialsReceivedAt: at }), `The ${ONBOARDING_HOURS}h clock started`);
        break;
      case 'signed':
        await this.run(() => this.store.update(o.id, { signedAt: at }));
        break;
      case 'live':
        await this.run(() => this.store.goLive(o.id, at), 'Live!');
        break;
      case 'block':
        await this.run(() => this.store.update(o.id, { status: 'blocked', blockedReason: asString(v['reason']) }), 'Marked blocked');
        break;
    }
  }

  protected async unblock(): Promise<void> {
    await this.run(() => this.store.update(this.onboarding().id, { status: 'in_progress' }), 'Back in progress');
  }

  protected async clearMaterials(): Promise<void> {
    await this.run(() => this.store.update(this.onboarding().id, { materialsReceivedAt: null }));
  }

  private async run(action: () => Promise<Onboarding>, message?: string): Promise<void> {
    this.busy.set(true);
    try {
      const item = await action();
      if (message) this.toast.show(message);
      this.changed.emit(item);
    } catch {
      /* the store showed the server's message */
    } finally {
      this.busy.set(false);
    }
  }
}
