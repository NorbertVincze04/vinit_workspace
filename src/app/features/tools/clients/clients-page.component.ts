import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import {
  ButtonComponent,
  ChipGroupComponent,
  ConfirmDialogComponent,
  EmptyStateComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
  IconComponent,
  InlineStat,
  InlineStatsComponent,
  LedgerComponent,
  PageHeaderComponent,
  TextFieldComponent,
  toFormValues,
} from '../../../shared/ui';
import { newSalonBody, newSalonFields } from '../salons/salons.fields';
import { PlansStore } from '../salons/plans.store';
import { SalonsStore } from '../salons/salons.store';
import { CLIENT_FIELDS, clientBody } from './clients.fields';
import { Client } from './clients.model';
import { ClientsStore } from './clients.store';
import { ClientRowComponent } from './components/client-row/client-row.component';

/** Clients tool: the people and companies that pay, each with (at most) one salon. */
@Component({
  selector: 'app-clients-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    TextFieldComponent,
    ChipGroupComponent,
    InlineStatsComponent,
    LedgerComponent,
    EmptyStateComponent,
    FormDialogComponent,
    ConfirmDialogComponent,
    ClientRowComponent,
  ],
  templateUrl: './clients-page.component.html',
  styles: '.summary { display: flex; margin-bottom: 12px; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsPageComponent {
  protected readonly store = inject(ClientsStore);
  private readonly salons = inject(SalonsStore);
  private readonly plans = inject(PlansStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly fields = CLIENT_FIELDS;

  /** Open form: null = closed; client = null for a new one. */
  protected readonly form = signal<{ client: Client | null; values: FormValues } | null>(null);
  /** "Add salon" for a client without one. */
  protected readonly salonForm = signal<{ client: Client; fields: FieldDef[] } | null>(null);
  protected readonly deleting = signal<Client | null>(null);

  protected readonly summary = computed<InlineStat[]>(() => {
    const all = this.store.clients();
    const stats: InlineStat[] = [
      { label: 'Clients', value: String(all.length) },
      { label: 'With a salon', value: String(all.length - this.store.withoutSalon().length) },
    ];
    const missing = this.store.missingAddress().length;
    if (missing) stats.push({ label: 'Address missing', value: String(missing), tone: 'negative' });
    return stats;
  });

  protected openNew(): void {
    this.form.set({ client: null, values: {} });
  }

  protected openEdit(client: Client): void {
    this.form.set({ client, values: toFormValues(client) });
  }

  protected async save(values: FormValues): Promise<void> {
    const body = clientBody(values);
    const editing = this.form()?.client;
    try {
      if (editing) {
        await this.store.update(editing.id, body);
        this.toast.show(`Saved ${body.name}`);
      } else {
        await this.store.create(body);
        this.toast.show(`Added ${body.name}`);
      }
    } catch {
      /* the store already showed why */
    }
  }

  protected openAddSalon(client: Client): void {
    // The client is fixed: offer only this one in the client list.
    const fields = newSalonFields([client], this.plans.plans()).map((f) =>
      f.key === 'clientId' ? { ...f, default: client.id, options: [{ value: client.id, label: client.name }] } : f,
    );
    this.salonForm.set({ client, fields });
  }

  protected async addSalon(values: FormValues): Promise<void> {
    try {
      const salon = await this.salons.create(newSalonBody(values));
      this.toast.show(`Added ${salon.name}`);
      void this.router.navigate(['/tools/salons', salon.id]);
    } catch {
      /* toast shown by the store */
    }
  }

  protected askDelete(client: Client): void {
    if (client.salonId) {
      this.toast.show(`${client.name} still has the salon ${client.salonName}. Delete the salon first.`, 6000);
      return;
    }
    this.deleting.set(client);
  }

  protected async confirmDelete(client: Client): Promise<void> {
    try {
      await this.store.remove(client.id);
      this.toast.show(`Deleted ${client.name}`);
    } catch {
      /* toast shown by the store */
    }
  }
}
