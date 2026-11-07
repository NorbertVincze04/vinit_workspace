import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ToastService } from '../../../../core/services/toast.service';
import { formatDate } from '../../../../core/utils/date';
import {
  ButtonComponent,
  ConfirmDialogComponent,
  Fact,
  FactsComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
  LedgerComponent,
  LedgerRowComponent,
  PanelComponent,
  StatusPillComponent,
  toFormValues,
} from '../../../../shared/ui';
import { AttachmentsComponent } from '../../contracts/components/attachments/attachments.component';
import { ContractDialogComponent } from '../../contracts/components/contract-dialog/contract-dialog.component';
import { Contract, SalonContracts, contractBody, contractFields, contractStatus, kindLabel } from '../../contracts/contracts.model';
import { ContractsStore } from '../../contracts/contracts.store';

/** Salon page tab: signed contract and DPA at a glance, all contracts, and the salon's files. */
@Component({
  selector: 'app-salon-contracts',
  standalone: true,
  imports: [PanelComponent, FactsComponent, ButtonComponent, LedgerComponent, LedgerRowComponent, StatusPillComponent, FormDialogComponent, ConfirmDialogComponent, ContractDialogComponent, AttachmentsComponent],
  template: `
    @if (data(); as d) {
      <div class="grid">
        <app-panel heading="Compliance">
          <app-facts [items]="facts()" />
        </app-panel>
        <app-panel heading="Files" [meta]="d.files.length + ''">
          <app-attachments [files]="d.files" [salonId]="salonId()" empty="No files for this salon yet (logo, photos, signed papers…)." (changed)="changed.emit()" />
        </app-panel>
      </div>
      <app-panel heading="Contracts" [meta]="d.contracts.length + ''" [flush]="d.contracts.length > 0">
        <button panelAction appButton variant="ghost" size="sm" type="button" (click)="openForm(null)">New contract</button>
        @if (d.contracts.length) {
          <app-ledger [headers]="['Contract', 'Signed', 'Renewal', 'Status']" columns="minmax(0, 2fr) 110px 110px 110px">
            @for (c of d.contracts; track c.id) {
              <app-ledger-row clickable (activate)="openId.set(c.id)">
                <div>
                  <span class="cell-title">{{ kind(c.kind) }}</span>
                  <span class="cell-sub">{{ c.number }}{{ c.files ? ' · ' + c.files + (c.files === 1 ? ' file' : ' files') : '' }}</span>
                </div>
                <span>{{ date(c.signedOn) || '—' }}</span>
                <span>{{ date(c.renewalOn) || '—' }}</span>
                <div><app-status-pill [tone]="status(c.status).tone">{{ status(c.status).label }}</app-status-pill></div>
              </app-ledger-row>
            }
          </app-ledger>
        } @else {
          <p class="muted small pad">No contract yet. Signing the subscription contract starts the onboarding.</p>
        }
      </app-panel>
    }

    @if (openId(); as id) {
      <app-contract-dialog [contractId]="id" (edit)="openForm($event)" (remove)="deleting.set($event)" (closed)="openId.set(null); changed.emit()" />
    }
    @if (form(); as f) {
      <app-form-dialog [heading]="f.item ? 'Edit contract' : 'New contract'" [fields]="f.fields" [initial]="f.values" saveLabel="Save contract" (saved)="save($event)" (closed)="form.set(null)" />
    }
    @if (deleting(); as c) {
      <app-confirm-dialog heading="Delete contract?" [message]="kind(c.kind) + ' ' + c.number + ' will be removed. Its files stay.'" cancelLabel="Keep it" (confirmed)="remove(c)" (closed)="deleting.set(null)" />
    }
  `,
  styles: `
    :host { display: grid; gap: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(380px, 100%), 1fr)); gap: 16px; align-items: start; }
    .pad { padding: 16px 18px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalonContractsComponent {
  readonly data = input<SalonContracts | null>(null);
  readonly salonId = input.required<string>();
  readonly changed = output<void>();

  private readonly store = inject(ContractsStore);
  private readonly toast = inject(ToastService);

  protected readonly openId = signal<string | null>(null);
  protected readonly form = signal<{ item: Contract | null; fields: FieldDef[]; values: FormValues } | null>(null);
  protected readonly deleting = signal<Contract | null>(null);
  protected readonly kind = kindLabel;
  protected readonly status = contractStatus;
  protected readonly date = formatDate;

  protected readonly facts = computed<Fact[]>(() => {
    const d = this.data();
    if (!d) return [];
    return [
      { label: 'Subscription contract', value: d.contractSignedOn ? `Signed ${formatDate(d.contractSignedOn)}` : 'Not signed', warn: !d.contractSignedOn },
      { label: 'DPA (GDPR)', value: d.dpaSignedOn ? `Signed ${formatDate(d.dpaSignedOn)}` : 'Not signed', warn: !d.dpaSignedOn },
    ];
  });

  protected openForm(item: Contract | null): void {
    this.form.set({ item, fields: contractFields(null), values: item ? { ...toFormValues(item), autoRenew: item.autoRenew } : {} });
  }

  protected async save(v: FormValues): Promise<void> {
    const f = this.form();
    if (!f) return;
    try {
      if (f.item) await this.store.update(f.item.id, contractBody(v));
      else await this.store.create({ ...contractBody(v), salonId: this.salonId() });
      this.toast.show('Contract saved');
      this.openId.set(null);
      this.changed.emit();
    } catch {
      /* toast shown */
    }
  }

  protected async remove(c: Contract): Promise<void> {
    try {
      await this.store.remove(c);
      this.openId.set(null);
      this.changed.emit();
    } catch {
      /* toast shown */
    }
  }
}
