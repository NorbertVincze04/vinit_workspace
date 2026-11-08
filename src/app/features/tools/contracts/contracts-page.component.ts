import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { daysUntil, formatDate } from '../../../core/utils/date';
import {
  ButtonComponent,
  ChipGroupComponent,
  ChipOption,
  ConfirmDialogComponent,
  EmptyStateComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
  IconComponent,
  LedgerComponent,
  LedgerRowComponent,
  PageHeaderComponent,
  PanelComponent,
  StatusPillComponent,
  toFormValues,
} from '../../../shared/ui';
import { SalonsStore } from '../salons/salons.store';
import { ContractDialogComponent } from './components/contract-dialog/contract-dialog.component';
import { Contract, contractBody, contractFields, contractStatus, kindLabel } from './contracts.model';
import { ContractsStore } from './contracts.store';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/** Contracts tool: who signed what, DPAs (GDPR), renewals, and which salons are missing paperwork. */
@Component({
  selector: 'app-contracts-page',
  standalone: true,
  imports: [TPipe, 
    RouterLink,
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    PanelComponent,
    ChipGroupComponent,
    LedgerComponent,
    LedgerRowComponent,
    StatusPillComponent,
    EmptyStateComponent,
    FormDialogComponent,
    ConfirmDialogComponent,
    ContractDialogComponent,
  ],
  templateUrl: './contracts-page.component.html',
  styles: `
    .gaps { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; font-size: 14px; }
    .gaps li { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
    .gaps a { font-weight: 600; color: var(--main); text-decoration: none; }
    .block { display: block; margin-bottom: 16px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractsPageComponent {
  protected readonly store = inject(ContractsStore);
  private readonly salons = inject(SalonsStore);
  private readonly toast = inject(ToastService);

  protected readonly filter = signal('all');
  protected readonly openId = signal<string | null>(null);
  protected readonly form = signal<{ item: Contract | null; fields: FieldDef[]; values: FormValues } | null>(null);
  protected readonly deleting = signal<Contract | null>(null);
  private readonly dialog = viewChild(ContractDialogComponent);

  protected readonly kindLabel = kindLabel;
  protected readonly status = contractStatus;
  protected readonly date = formatDate;

  /** Salons on the platform missing a signed contract or DPA, or renewing within 30 days. */
  protected readonly gaps = computed(() =>
    this.store
      .compliance()
      .map((r) => ({
        ...r,
        problems: [
          !r.contractSignedOn ? { text: t('No signed contract'), tone: 'bad' as const } : null,
          !r.dpaSignedOn ? { text: t('No signed DPA'), tone: 'bad' as const } : null,
          r.renewalOn ? { text: t('Renewal {date}', { date: formatDate(r.renewalOn) }), tone: 'warn' as const } : null,
        ].filter((p) => p !== null),
      }))
      .filter((r) => r.problems.length),
  );

  protected readonly chips = computed<ChipOption[]>(() => {
    const all = this.store.items();
    return [
      { value: 'all', label: 'All', count: all.length },
      { value: 'open', label: 'Draft or sent', count: all.filter((c) => c.status === 'draft' || c.status === 'sent').length },
      { value: 'signed', label: 'Signed', count: all.filter((c) => c.status === 'signed').length },
      { value: 'renewal', label: 'Renewal in 60 days', count: all.filter((c) => this.renewsSoon(c)).length },
    ];
  });

  protected readonly visible = computed(() => {
    const f = this.filter();
    return this.store
      .items()
      .filter((c) => f === 'all' || (f === 'open' ? c.status === 'draft' || c.status === 'sent' : f === 'signed' ? c.status === 'signed' : this.renewsSoon(c)));
  });

  private renewsSoon(c: Contract): boolean {
    return c.status === 'signed' && !!c.renewalOn && daysUntil(c.renewalOn) >= 0 && daysUntil(c.renewalOn) <= 60;
  }

  constructor() {
    if (this.store.loaded()) void this.store.reload();
  }

  protected openForm(item: Contract | null, salonId?: string): void {
    const salons = item ? null : this.salons.salons().filter((s) => s.status !== 'churned').map((s) => ({ value: s.id, label: s.name }));
    this.form.set({
      item,
      fields: contractFields(salons),
      values: item ? { ...toFormValues(item), autoRenew: item.autoRenew } : salonId ? { salonId } : {},
    });
  }

  protected async save(v: FormValues): Promise<void> {
    const f = this.form();
    if (!f) return;
    try {
      if (f.item) {
        await this.store.update(f.item.id, contractBody(v));
        this.dialog()?.refresh();
      } else {
        const c = await this.store.create(contractBody(v));
        this.openId.set(c.id);
      }
      this.toast.show('Contract saved');
    } catch {
      /* toast shown */
    }
  }

  protected async confirmDelete(c: Contract): Promise<void> {
    try {
      await this.store.remove(c);
      this.openId.set(null);
      this.toast.show('Contract deleted');
    } catch {
      /* toast shown */
    }
  }
}
