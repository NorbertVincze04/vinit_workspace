import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { formatDate, formatDateTime, todayISO } from '../../../core/utils/date';
import { formatMoney, formatRon, percent } from '../../../core/utils/format';
import { KpiCardComponent } from '../../../shared/components';
import {
  ButtonComponent,
  ConfirmDialogComponent,
  EmptyStateComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
  IconComponent,
  LedgerComponent,
  LedgerRowComponent,
  MonthSwitcherComponent,
  PageHeaderComponent,
  PanelComponent,
  StatTone,
  StatusPillComponent,
  asNumber,
  asString,
} from '../../../shared/ui';
import { formatBytes } from '../files/files.model';
import { FinancesStore } from '../finances/finances.store';
import { SalonsStore } from '../salons/salons.store';
import { ToastService } from '../../../core/services/toast.service';
import { BackupCheck, InfraService, SmsUsage, backupTone, optionalAmount, parseOptionalAmount, serviceBody, serviceCategory, serviceFields } from './infra.model';
import { InfraStore } from './infra.store';
import { IntegrationsPanelComponent } from './integrations-panel.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { countOf, t } from '../../../core/i18n/i18n';
import { TcPipe } from '../../../core/i18n/tc.pipe';

type Dialog =
  | { kind: 'service'; item: InfraService | null; fields: FieldDef[]; values: FormValues }
  | { kind: 'sms'; fields: FieldDef[]; values: FormValues }
  | { kind: 'backup' | 'restore_test'; fields: FieldDef[]; values: FormValues };

/** Infra tool: what the setup costs each month, SMS against the budget, backups and their tests. */
@Component({
  selector: 'app-infra-page',
  standalone: true,
  imports: [TcPipe, TPipe, 
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    KpiCardComponent,
    PanelComponent,
    LedgerComponent,
    LedgerRowComponent,
    StatusPillComponent,
    MonthSwitcherComponent,
    EmptyStateComponent,
    FormDialogComponent,
    ConfirmDialogComponent,
    IntegrationsPanelComponent,
  ],
  templateUrl: './infra-page.component.html',
  styles: `
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(230px, 100%), 1fr)); gap: 12px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr)); gap: 16px; align-items: start; margin-top: 16px; }
    .links { display: flex; gap: 10px; font-size: 13px; }
    .links a { color: var(--main); text-decoration: none; }
    .rows { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; font-size: 14px; }
    .rows li { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
    .rows .push { margin-left: auto; }
    .bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
    .x { width: 28px; height: 28px; font-size: 18px; color: var(--muted); background: none; border: 0; border-radius: var(--radius-md); cursor: pointer; }
    .x:hover { background: var(--hover); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfraPageComponent {
  protected readonly store = inject(InfraStore);
  private readonly finances = inject(FinancesStore);
  private readonly salons = inject(SalonsStore);
  private readonly toast = inject(ToastService);

  protected readonly smsMonth = signal(todayISO().slice(0, 7));
  protected readonly smsRows = signal<SmsUsage[]>([]);
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly deleting = signal<InfraService | null>(null);

  protected readonly category = serviceCategory;
  protected readonly date = formatDate;
  protected readonly when = formatDateTime;
  protected readonly ron = (bani: number) => formatRon(bani / 100);
  protected readonly money = (bani: number, cur: string) => formatMoney(bani / 100, cur);

  protected readonly cards = computed(() => {
    const h = this.store.health();
    if (!h) return [];
    const b = h.backups;
    const toneOf = (tone: string): StatTone => (tone === 'bad' ? 'negative' : tone === 'ok' ? 'positive' : 'default');
    const age = (days: number | null) => (days === null ? t('Never') : days === 0 ? t('Today') : t('{days} ago', { days: countOf(days, 'day', 'days') }));
    return [
      {
        label: 'Infrastructure per month',
        value: this.ron(h.costs.monthlyRonBani),
        hint: t('{services} · plan budget {budget} (all operating costs)', { services: countOf(h.costs.services, 'service', 'services'), budget: this.ron(h.costs.planBani) }),
        tone: (h.costs.monthlyRonBani > h.costs.planBani ? 'negative' : 'default') as StatTone,
        percent: percent(h.costs.monthlyRonBani, h.costs.planBani),
      },
      {
        label: 'SMS this month',
        value: `${h.sms.sent} / ${h.sms.budget}`,
        hint: h.sms.premiumSalons ? t('{salons} with SMS · about {n} each', { salons: countOf(h.sms.premiumSalons, 'salon', 'salons'), n: h.sms.perSalonBudget ?? '—' }) : t('No salon with SMS reminders yet'),
        tone: (h.sms.pct >= 100 ? 'negative' : 'default') as StatTone,
        percent: h.sms.pct,
      },
      {
        label: 'Last backup',
        value: age(b.lastBackupDays),
        hint: b.lastBackupFile ? b.lastBackupFile : t('Run npm run db:backup and keep a copy off this PC'),
        tone: toneOf(backupTone(b.lastBackupDays, 7, 30)),
        percent: null,
      },
      {
        label: 'Last restore test',
        value: age(b.lastRestoreTestDays),
        hint: 'A backup only counts once a restore worked. Aim for every 3 months.',
        tone: toneOf(backupTone(b.lastRestoreTestDays, 90, 180)),
        percent: null,
      },
      {
        label: 'Storage',
        value: formatBytes(h.storage.dbBytes),
        hint: t('database, of which {size} uploaded files', { size: formatBytes(h.storage.fileBytes) }),
        tone: 'default' as StatTone,
        percent: null,
      },
    ];
  });

  protected readonly backupMeta = (b: BackupCheck): string => [b.fileName, b.note, b.checkedByName].filter(Boolean).join(' · ');
  protected readonly smsTotal = computed(() => this.smsRows().reduce((s, r) => s + r.sent, 0));

  constructor() {
    void this.store.reload();
    effect(
      () => {
        const m = this.smsMonth();
        untracked(() => void this.loadSms(m));
      },
      { allowSignalWrites: true },
    );
  }

  private async loadSms(month: string): Promise<void> {
    this.smsRows.set(await this.store.sms(month));
  }

  // ---- services ----

  protected openService(item: InfraService | null): void {
    const recurring = this.finances.recurring
      .items()
      .filter((r) => r.type === 'expense')
      .map((r) => ({ value: r.id, label: `${r.name} · ${formatMoney(r.amount, r.currency)} ${r.frequency}` }));
    this.dialog.set({
      kind: 'service',
      item,
      fields: serviceFields(recurring),
      values: item
        ? {
            name: item.name,
            vendor: item.vendor,
            category: item.category,
            planName: item.planName,
            recurringId: item.recurringId ?? '',
            monthlyCost: item.monthlyCostBani === null ? '' : String(item.monthlyCostBani / 100),
            currency: item.currency,
            renewsOn: item.renewsOn ?? '',
            dashboardUrl: item.dashboardUrl,
            statusUrl: item.statusUrl,
            passwordManagerRef: item.passwordManagerRef,
            active: item.active,
            notes: item.notes,
          }
        : {},
    });
  }

  // ---- SMS ----

  protected openSms(): void {
    const premium = this.salons.salons().filter((s) => s.planCode === 'premium' && s.status !== 'churned');
    this.dialog.set({
      kind: 'sms',
      fields: [
        { key: 'salonId', label: 'Salon', type: 'select', span: 'full', options: [{ value: '', label: 'Whole account (no split per salon)' }, ...premium.map((s) => ({ value: s.id, label: s.name }))] },
        { key: 'sent', label: 'SMS sent', type: 'number', required: true, integer: true, min: 0, placeholder: '320' },
        { key: 'cost', label: 'Cost (RON)', type: 'text', maxLength: 12, placeholder: 'Empty: 0,20 RON per SMS', validate: optionalAmount },
      ],
      values: {},
    });
  }

  protected async removeSms(r: SmsUsage): Promise<void> {
    try {
      await this.store.removeSms(r.id);
      await this.loadSms(this.smsMonth());
    } catch {
      /* toast shown */
    }
  }

  // ---- backups ----

  protected openBackup(kind: 'backup' | 'restore_test'): void {
    this.dialog.set({
      kind,
      fields: [
        { key: 'fileName', label: 'Backup file', type: 'text', maxLength: 255, placeholder: 'vinit-2026-11-07-1530.dump' },
        {
          key: 'note',
          label: 'Note',
          type: 'textarea',
          span: 'full',
          maxLength: 1000,
          placeholder: kind === 'backup' ? 'Copied to the external drive' : 'Restored into a test database, salons and files OK',
        },
      ],
      values: {},
    });
  }

  protected readonly titles: Record<Dialog['kind'], string> = {
    service: 'Service',
    sms: 'SMS usage',
    backup: 'Record a backup',
    restore_test: 'Record a restore test',
  };

  protected async saved(v: FormValues): Promise<void> {
    const d = this.dialog();
    if (!d) return;
    try {
      if (d.kind === 'service') {
        await this.store.saveService(d.item?.id ?? null, serviceBody(v));
        this.toast.show('Service saved');
      } else if (d.kind === 'sms') {
        const cost = parseOptionalAmount(v['cost']);
        await this.store.saveSms({
          month: this.smsMonth(),
          salonId: asString(v['salonId']) || null,
          sent: Math.round(asNumber(v['sent'])),
          ...(cost !== null ? { costBani: Math.round(cost * 100) } : {}),
        });
        await this.loadSms(this.smsMonth());
        this.toast.show('SMS usage saved');
      } else {
        await this.store.recordBackup({ kind: d.kind, fileName: asString(v['fileName']), note: asString(v['note']) });
        this.toast.show('Recorded');
      }
    } catch {
      /* toast shown */
    }
  }

  protected async confirmDelete(s: InfraService): Promise<void> {
    try {
      await this.store.removeService(s.id);
      this.toast.show(t('Removed {name}', { name: s.name }));
    } catch {
      /* toast shown */
    }
  }
}
