import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { toLocalDateTime } from '../../../core/utils/date';
import { parseCsv } from '../../../core/utils/file';
import { plural } from '../../../core/utils/format';
import {
  ButtonComponent,
  ChipGroupComponent,
  ConfirmDialogComponent,
  DialogComponent,
  EmptyStateComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
  IconComponent,
  InlineStat,
  InlineStatsComponent,
  LedgerComponent,
  MenuComponent,
  MenuItemComponent,
  PageHeaderComponent,
  SegmentedComponent,
  TextFieldComponent,
  asString,
  toFormValues,
} from '../../../shared/ui';
import { ClientsStore } from '../clients/clients.store';
import { PlansStore } from '../salons/plans.store';
import { SalonsStore } from '../salons/salons.store';
import { LeadBoardComponent, LeadDrop } from './components/lead-board/lead-board.component';
import { LeadDialogComponent } from './components/lead-dialog/lead-dialog.component';
import { LeadRowComponent } from './components/lead-row/lead-row.component';
import { LOST_FIELDS, convertBody, convertFields, leadBody, leadFields } from './leads.fields';
import { ImportPreview, leadsFromTable } from './leads.import';
import { Lead, LeadStage } from './leads.model';
import { LeadsStore } from './leads.store';

type Form =
  | { kind: 'lead'; lead: Lead | null; fields: FieldDef[]; values: FormValues }
  | { kind: 'lost'; lead: Lead; stage: LeadStage; position?: number }
  | { kind: 'convert'; lead: Lead; fields: FieldDef[] };

/** Leads tool: the sales pipeline as a board (drag cards between stages) or a list. */
@Component({
  selector: 'app-leads-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    MenuComponent,
    MenuItemComponent,
    TextFieldComponent,
    ChipGroupComponent,
    SegmentedComponent,
    InlineStatsComponent,
    LedgerComponent,
    EmptyStateComponent,
    FormDialogComponent,
    ConfirmDialogComponent,
    DialogComponent,
    LeadBoardComponent,
    LeadRowComponent,
    LeadDialogComponent,
  ],
  templateUrl: './leads-page.component.html',
  styles: `
    .summary { display: flex; margin-bottom: 12px; }
    .mapping { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 4px 16px; font-size: 13.5px; margin-top: 12px; }
    .mapping .muted { font-style: italic; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadsPageComponent {
  protected readonly store = inject(LeadsStore);
  private readonly plans = inject(PlansStore);
  private readonly salons = inject(SalonsStore);
  private readonly clients = inject(ClientsStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly openId = signal<string | null>(null);
  protected readonly form = signal<Form | null>(null);
  protected readonly deleting = signal<Lead | null>(null);
  protected readonly importing = signal<(ImportPreview & { file: string }) | null>(null);
  private readonly detail = viewChild(LeadDialogComponent);

  protected readonly lostFields = LOST_FIELDS;
  protected readonly views = [
    { value: 'board', label: 'Board' },
    { value: 'list', label: 'List' },
  ];

  protected readonly summary = computed<InlineStat[]>(() => {
    const all = this.store.leads();
    const count = (stage: LeadStage) => all.filter((l) => l.stage === stage).length;
    const won = count('trial') + count('paying');
    const closed = won + count('lost');
    const stats: InlineStat[] = [
      { label: 'Open', value: String(all.filter((l) => this.store.isOpen(l)).length) },
      { label: 'Demos booked', value: String(count('demo_booked')) },
      { label: 'Won', value: String(won) },
      { label: 'Lost', value: String(count('lost')) },
    ];
    if (closed) stats.push({ label: 'Win rate', value: `${Math.round((won / closed) * 100)}%` });
    const late = this.store.overdue().length;
    if (late) stats.push({ label: 'Follow-ups late', value: String(late), tone: 'negative' });
    return stats;
  });

  constructor() {
    // Salon status changes move converted leads on the server: start from fresh data.
    if (this.store.loaded()) void this.store.reload();
  }

  // ---- lead form ----

  protected openNew(): void {
    this.form.set({ kind: 'lead', lead: null, fields: leadFields(this.plans.plans(), this.salons.salons(), true), values: {} });
  }

  protected openEdit(lead: Lead): void {
    this.form.set({
      kind: 'lead',
      lead,
      fields: leadFields(this.plans.plans(), this.salons.salons(), false),
      values: { ...toFormValues(lead), employees: lead.employees || '', demoAt: toLocalDateTime(lead.demoAt) },
    });
  }

  protected async saveLead(values: FormValues): Promise<void> {
    const f = this.form();
    if (f?.kind !== 'lead') return;
    try {
      if (f.lead) {
        await this.store.update(f.lead.id, leadBody(values, false) as Partial<Lead>);
        this.toast.show('Lead saved');
        this.detail()?.refresh();
      } else {
        const lead = await this.store.create(leadBody(values, true));
        this.toast.show(`Added ${lead.businessName}`);
      }
    } catch {
      /* toast shown by the store */
    }
  }

  // ---- moving ----

  /** Board drop: translate the index among visible cards into a position in the whole column. */
  protected async onDrop(drop: LeadDrop): Promise<void> {
    const visible = (this.store.columns().find((c) => c.stage === drop.stage)?.leads ?? []).filter((l) => l.id !== drop.lead.id);
    const full = this.store
      .leads()
      .filter((l) => l.stage === drop.stage && l.id !== drop.lead.id)
      .sort((a, b) => a.stagePosition - b.stagePosition);
    const { lead, stage } = drop;
    if (stage !== lead.stage && lead.convertedSalonId) {
      this.toast.show(`${lead.businessName} is already a salon: its stage follows the salon's status.`, 6000);
      return;
    }
    if (stage === 'trial' || stage === 'paying') {
      this.openConvert(lead, stage === 'paying' ? 'active' : 'trial');
      return;
    }
    const anchor = visible[drop.index];
    const position = anchor ? full.findIndex((l) => l.id === anchor.id) : full.length;
    if (drop.stage === 'lost' && drop.lead.stage !== 'lost') {
      this.form.set({ kind: 'lost', lead: drop.lead, stage: 'lost', position });
      return;
    }
    await this.store.move(drop.lead.id, drop.stage, position);
  }

  protected askLost(lead: Lead): void {
    this.form.set({ kind: 'lost', lead, stage: 'lost' });
  }

  protected async saveLost(values: FormValues): Promise<void> {
    const f = this.form();
    if (f?.kind !== 'lost') return;
    const ok = await this.store.move(f.lead.id, 'lost', f.position, {
      lostReason: asString(values['lostReason']),
      lostNote: asString(values['lostNote']),
    });
    if (ok) {
      this.toast.show(`${f.lead.businessName} marked lost`);
      this.detail()?.refresh();
    }
  }

  // ---- convert ----

  protected openConvert(lead: Lead, status: 'trial' | 'active' = 'trial'): void {
    const fields = convertFields(lead, this.plans.plans(), this.clients.withoutSalon()).map((f) =>
      f.key === 'status' ? { ...f, default: status } : f,
    );
    this.form.set({ kind: 'convert', lead, fields });
  }

  protected async saveConvert(values: FormValues): Promise<void> {
    const f = this.form();
    if (f?.kind !== 'convert') return;
    try {
      const salonId = await this.store.convert(f.lead.id, convertBody(values));
      this.toast.show(`${f.lead.businessName} is now a salon`);
      this.openId.set(null);
      void this.router.navigate(['/tools/salons', salonId]);
    } catch {
      /* toast shown by the store */
    }
  }

  // ---- delete ----

  protected async confirmDelete(lead: Lead): Promise<void> {
    try {
      await this.store.remove(lead.id);
      this.openId.set(null);
      this.toast.show(`Deleted ${lead.businessName}`);
    } catch {
      /* toast shown */
    }
  }

  // ---- import ----

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      this.toast.show('Save the spreadsheet as CSV first (Excel: File › Save As › CSV UTF-8).', 7000);
      return;
    }
    const preview = leadsFromTable(parseCsv(await file.text()));
    if (!preview.rows.length) {
      this.toast.show('No leads found. The first row must hold column names such as "Business Name" and "Phone".', 7000);
      return;
    }
    this.importing.set({ ...preview, file: file.name });
  }

  protected async runImport(dialog: DialogComponent): Promise<void> {
    const p = this.importing();
    if (!p) return;
    try {
      const res = await this.store.importRows(p.rows);
      const skipped = res.skipped.length ? `, ${res.skipped.length} already on the board` : '';
      this.toast.show(`Imported ${res.created} ${plural(res.created, 'lead', 'leads')}${skipped}`, 6000);
      dialog.close();
    } catch {
      /* toast shown */
    }
  }

  protected setView(value: string): void {
    this.store.view.set(value === 'list' ? 'list' : 'board');
  }

  protected fieldLabel(field: string): string {
    const labels: Record<string, string> = {
      businessName: 'Business name',
      contactName: 'Contact',
      email: 'Email',
      phone: 'Phone',
      employees: 'Barbers / staff',
      services: 'Services',
      website: 'Website',
      city: 'City',
      instagram: 'Instagram',
      notes: 'Notes',
    };
    return labels[field] ?? '';
  }
}
