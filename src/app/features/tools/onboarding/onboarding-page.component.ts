import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { fromLocalDateTime, toLocalDateTime } from '../../../core/utils/date';
import {
  ButtonComponent,
  ChipGroupComponent,
  ChipOption,
  EmptyStateComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
  IconComponent,
  InlineStat,
  InlineStatsComponent,
  LedgerComponent,
  LedgerRowComponent,
  MenuComponent,
  MenuItemComponent,
  PageHeaderComponent,
  ProgressBarComponent,
  StatusPillComponent,
  asString,
  notBefore,
} from '../../../shared/ui';
import { SalonsStore } from '../salons/salons.store';
import { TemplateEditorComponent } from './components/template-editor/template-editor.component';
import { ONBOARDING_HOURS, Onboarding, clockOf, statusOf } from './onboarding.model';
import { OnboardingStore } from './onboarding.store';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/** Onboarding tool: every salon being set up, with the 48h clock and checklist progress. */
@Component({
  selector: 'app-onboarding-page',
  standalone: true,
  imports: [TPipe, 
    RouterLink,
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    MenuComponent,
    MenuItemComponent,
    ChipGroupComponent,
    InlineStatsComponent,
    LedgerComponent,
    LedgerRowComponent,
    StatusPillComponent,
    ProgressBarComponent,
    EmptyStateComponent,
    FormDialogComponent,
    TemplateEditorComponent,
  ],
  templateUrl: './onboarding-page.component.html',
  styles: `
    .summary { display: flex; margin-bottom: 12px; }
    .link { color: inherit; text-decoration: none; }
    .link:hover { color: var(--main); text-decoration: underline; }
    .progress { display: grid; gap: 4px; font-size: 12.5px; color: var(--muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingPageComponent {
  protected readonly store = inject(OnboardingStore);
  private readonly salons = inject(SalonsStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly filter = signal('open');
  protected readonly startForm = signal<FieldDef[] | null>(null);
  protected readonly editingTemplate = signal(false);
  protected readonly clockOf = clockOf;
  protected readonly statusOf = statusOf;
  protected readonly percent = (o: Onboarding) => (o.stepsTotal ? Math.round((o.stepsDone / o.stepsTotal) * 100) : 0);

  protected readonly chips = computed<ChipOption[]>(() => [
    { value: 'open', label: 'In progress', count: this.store.open().length },
    { value: 'late', label: t('Over {h}h', { h: ONBOARDING_HOURS }), count: this.store.late().length },
    { value: 'waiting', label: 'Waiting for materials', count: this.store.waiting().length },
    { value: 'done', label: 'Live', count: this.store.items().length - this.store.open().length },
  ]);

  protected readonly visible = computed(() => {
    const f = this.filter();
    const list = this.store.items();
    return f === 'open' ? this.store.open() : f === 'late' ? this.store.late() : f === 'waiting' ? this.store.waiting() : list.filter((o) => o.status === 'done');
  });

  protected readonly summary = computed<InlineStat[]>(() => {
    const done = this.store.items().filter((o) => o.status === 'done');
    const onTime = done.filter((o) => !o.late).length;
    const stats: InlineStat[] = [
      { label: 'In progress', value: String(this.store.open().length) },
      { label: t('Over {h}h now', { h: ONBOARDING_HOURS }), value: String(this.store.late().length), tone: this.store.late().length ? 'negative' : 'default' },
    ];
    if (done.length) {
      stats.push({ label: t('Live within {h}h', { h: ONBOARDING_HOURS }), value: t('{n} of {total}', { n: onTime, total: done.length }) });
      stats.push({ label: 'Average', value: `${this.store.averageHours()}h`, suffix: 'from materials to live' });
    }
    return stats;
  });

  constructor() {
    // The clock moves: start from fresh figures every time the page opens.
    if (this.store.loaded()) void this.store.reload();
  }

  protected openStart(): void {
    const taken = new Set(this.store.items().map((o) => o.salonId));
    const options = this.salons
      .salons()
      .filter((s) => !taken.has(s.id) && s.status !== 'churned')
      .map((s) => ({ value: s.id, label: s.name }));
    this.startForm.set([
      { key: 'salonId', label: 'Salon', type: 'select', required: true, span: 'full', options: [{ value: '', label: 'Pick a salon' }, ...options] },
      { key: 'signedAt', label: 'Signed at', type: 'datetime', required: true, default: () => toLocalDateTime(new Date().toISOString()) },
      { key: 'materialsReceivedAt', label: 'Materials received at', type: 'datetime', validate: notBefore('signedAt', 'The materials can’t arrive before the signing.'), hint: t('Leave empty until they arrive: the {h}h clock starts then.', { h: ONBOARDING_HOURS }) },
    ]);
  }

  protected async start(v: FormValues): Promise<void> {
    const salonId = asString(v['salonId']);
    try {
      await this.store.start(salonId, {
        signedAt: fromLocalDateTime(asString(v['signedAt'])),
        ...(asString(v['materialsReceivedAt']) ? { materialsReceivedAt: fromLocalDateTime(asString(v['materialsReceivedAt'])) } : {}),
      });
      this.toast.show('Onboarding started');
      void this.router.navigate(['/tools/salons', salonId], { queryParams: { tab: 'onboarding' } });
    } catch {
      /* toast shown */
    }
  }
}
