import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { downloadJson, readJsonFile } from '../../../core/utils/file';
import { BackupActionsComponent, SaveStatusComponent } from '../../../shared/components';
import {
  ButtonComponent,
  ChipGroupComponent,
  ConfirmDialogComponent,
  EmptyStateComponent,
  FormDialogComponent,
  FormValues,
  IconComponent,
  LedgerComponent,
  PageHeaderComponent,
  SelectFieldComponent,
  SelectOption,
  TextFieldComponent,
  toFormValues,
} from '../../../shared/ui';
import { CLIENT_FIELDS, clientFromForm } from './clients.fields';
import { Client, ClientSort } from './clients.model';
import { ClientsStore } from './clients.store';
import { ClientRowComponent } from './components/client-row/client-row.component';
import { ClientsOverviewComponent } from './components/clients-overview/clients-overview.component';

/** Clients tool: salon pipeline from lead to paying customer. */
@Component({
  selector: 'app-clients-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    TextFieldComponent,
    SelectFieldComponent,
    ChipGroupComponent,
    LedgerComponent,
    EmptyStateComponent,
    FormDialogComponent,
    ConfirmDialogComponent,
    BackupActionsComponent,
    SaveStatusComponent,
    ClientsOverviewComponent,
    ClientRowComponent,
  ],
  templateUrl: './clients-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientsPageComponent {
  protected readonly store = inject(ClientsStore);
  private readonly toast = inject(ToastService);

  protected readonly fields = CLIENT_FIELDS;
  protected readonly sortOptions: readonly SelectOption[] = [
    { value: 'newest', label: 'Newest first' },
    { value: 'name', label: 'Salon A to Z' },
  ];

  /** Open form: null = closed; client = null for a new one. */
  protected readonly form = signal<{ client: Client | null; values: FormValues } | null>(null);
  protected readonly deleting = signal<Client | null>(null);

  protected openNew(): void {
    this.form.set({ client: null, values: {} });
  }

  protected openEdit(client: Client): void {
    this.form.set({ client, values: toFormValues(client) });
  }

  protected save(values: FormValues): void {
    const data = clientFromForm(values);
    const editing = this.form()?.client;
    if (editing) {
      this.store.update(editing.id, data);
      this.toast.show(`Saved ${data.salon}`);
    } else {
      this.store.add(data);
      this.toast.show(`Added ${data.salon}`);
    }
  }

  protected confirmDelete(client: Client): void {
    this.store.remove(client.id);
    this.toast.show(`Deleted ${client.salon || 'client'}`);
  }

  protected setSort(value: string): void {
    this.store.setFilters({ sort: value as ClientSort });
  }

  protected exportBackup(): void {
    downloadJson(this.store.snapshot(), 'vinit-clients-backup.json');
  }

  protected async importBackup(file: File): Promise<void> {
    try {
      const ok = this.store.importState(await readJsonFile(file));
      this.toast.show(ok ? 'Clients imported' : 'That file is not a VINIT clients backup.');
    } catch {
      this.toast.show('That file is not a VINIT clients backup.');
    }
  }
}
