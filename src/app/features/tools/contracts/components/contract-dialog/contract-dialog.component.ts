import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiError } from '../../../../../core/api/api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { formatDate } from '../../../../../core/utils/date';
import { ButtonComponent, DialogComponent, Fact, FactsComponent } from '../../../../../shared/ui';
import { Contract, contractStatus, kindLabel } from '../../contracts.model';
import { ContractsStore } from '../../contracts.store';
import { Attachment, AttachmentsComponent } from '../attachments/attachments.component';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { t } from '../../../../../core/i18n/i18n';

/** One contract: its dates, its files (signed PDF…), edit and delete. */
@Component({
  selector: 'app-contract-dialog',
  standalone: true,
  imports: [TPipe, DialogComponent, ButtonComponent, FactsComponent, AttachmentsComponent, RouterLink],
  template: `
    <app-dialog #dialog size="lg" [heading]="heading()" [subheading]="item()?.salonName ?? ''" (closed)="closed.emit()">
      @if (item(); as c) {
        <app-facts [items]="facts()" />
        @if (c.notes) {
          <p class="notes">{{ c.notes }}</p>
        }
        <h3>{{ 'Files' | t }}</h3>
        <app-attachments [files]="files()" [contractId]="c.id" [salonId]="c.salonId" empty="No file yet: attach the signed PDF." (changed)="refresh()" />
        <p class="small"><a [routerLink]="['/tools/salons', c.salonId]" [queryParams]="{ tab: 'contracts' }" (click)="dialog.close()">{{ 'Open' | t }} {{ c.salonName }} →</a></p>
      } @else {
        <p class="muted">{{ 'Loading…' | t }}</p>
      }
      <div dialogFooter class="footer">
        @if (item(); as c) {
          <button appButton variant="ghost" type="button" (click)="remove.emit(c)">{{ 'Delete' | t }}</button>
          <span class="spacer"></span>
          <button appButton type="button" (click)="edit.emit(c)">{{ 'Edit' | t }}</button>
          @if (c.status === 'draft' || c.status === 'sent') {
            <button appButton variant="primary" type="button" (click)="sign(c)">{{ 'Mark signed today' | t }}</button>
          }
        }
      </div>
    </app-dialog>
  `,
  styles: `
    .notes { white-space: pre-line; font-size: 14px; margin-top: 12px; }
    h3 { font-size: 14px; font-weight: 600; margin: 18px 0 8px; }
    .small { margin-top: 14px; font-size: 13.5px; }
    .small a { color: var(--main); text-decoration: none; font-weight: 600; }
    .footer { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; }
    .spacer { flex: 1; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractDialogComponent {
  readonly contractId = input.required<string>();
  readonly edit = output<Contract>();
  readonly remove = output<Contract>();
  readonly closed = output<void>();

  private readonly store = inject(ContractsStore);
  private readonly toast = inject(ToastService);

  protected readonly item = signal<Contract | null>(null);
  protected readonly files = signal<Attachment[]>([]);
  protected readonly heading = computed(() => {
    const c = this.item();
    return c ? `${kindLabel(c.kind)} ${c.number}` : 'Contract';
  });
  protected readonly facts = computed<Fact[]>(() => {
    const c = this.item();
    if (!c) return [];
    const s = contractStatus(c.status);
    return [
      { label: 'Status', value: s.label, tone: s.tone },
      { label: 'Client', value: c.clientName ?? '' },
      { label: 'Signed', value: formatDate(c.signedOn) },
      { label: 'Starts', value: formatDate(c.startsOn) },
      { label: 'Ends', value: formatDate(c.endsOn) },
      { label: 'Renewal', value: formatDate(c.renewalOn), hint: c.renewalOn ? (c.autoRenew ? 'renews automatically' : 'to renew by hand') : '' },
    ];
  });

  constructor() {
    effect(
      () => {
        const id = this.contractId();
        untracked(() => void this.load(id));
      },
      { allowSignalWrites: true },
    );
  }

  refresh(): void {
    void this.load(this.contractId());
    void this.store.reload();
  }

  private async load(id: string): Promise<void> {
    try {
      const res = await this.store.get(id);
      this.item.set(res.item);
      this.files.set(res.files);
    } catch (e) {
      this.toast.show(t('Could not load the contract: {error}', { error: apiError(e).message }), 6000);
    }
  }

  protected async sign(c: Contract): Promise<void> {
    try {
      this.item.set(await this.store.update(c.id, { status: 'signed' }));
      this.toast.show(c.kind === 'subscription' ? 'Signed: the onboarding has started' : 'Signed');
    } catch {
      /* toast shown */
    }
  }
}
