import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { ApiService, apiError } from '../../../core/api/api.service';
import { apiCollection } from '../../../core/api/api-collection';
import { ToastService } from '../../../core/services/toast.service';
import { uuid } from '../../../core/utils/id';
import { matchesSearch } from '../../../core/utils/text';
import { ChipOption } from '../../../shared/ui';
import { SalonsStore } from '../salons/salons.store';
import { CLIENT_FIELD_MAP, Client, ClientFilters } from './clients.model';

/** Clients: the people and companies that pay. Saved on the server; one client has at most one salon. */
@Injectable({ providedIn: 'root' })
export class ClientsStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly collection = apiCollection<Client>('/clients', CLIENT_FIELD_MAP, uuid);

  readonly clients = this.collection.items;
  readonly loaded = this.collection.loaded;
  readonly filters = signal<ClientFilters>({ q: '', show: 'all' });

  /** Clients a new salon can be attached to. */
  readonly withoutSalon = computed(() => this.clients().filter((c) => !c.salonId));
  readonly missingAddress = computed(() => this.clients().filter((c) => !c.businessAddress));

  readonly chips = computed<ChipOption[]>(() => {
    const list = this.clients();
    const chips: ChipOption[] = [
      { value: 'all', label: 'All', count: list.length },
      { value: 'with-salon', label: 'With salon', count: list.length - this.withoutSalon().length },
      { value: 'without-salon', label: 'No salon yet', count: this.withoutSalon().length },
    ];
    if (this.missingAddress().length) chips.push({ value: 'missing-address', label: 'Address missing', count: this.missingAddress().length });
    return chips;
  });

  readonly visible = computed(() => {
    const { q, show } = this.filters();
    return this.clients()
      .filter(
        (c) =>
          show === 'all' ||
          (show === 'with-salon' && !!c.salonId) ||
          (show === 'without-salon' && !c.salonId) ||
          (show === 'missing-address' && !c.businessAddress),
      )
      .filter((c) => matchesSearch(q, c.name, c.contactPerson, c.city, c.email, c.phone, c.salonName, c.businessAddress))
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  });

  get(id: string): Client | undefined {
    return this.collection.get(id);
  }

  setFilters(patch: Partial<ClientFilters>): void {
    this.filters.update((f) => ({ ...f, ...patch }));
  }

  clearFilters(): void {
    this.filters.set({ q: '', show: 'all' });
  }

  create(body: Partial<Client>): Promise<Client> {
    return this.collection.create(body as Record<string, unknown>);
  }

  async update(id: string, patch: Partial<Client>): Promise<Client> {
    const client = await this.collection.save(id, patch);
    // The salon list shows the client's name and contact details.
    if (client.salonId) void this.salons().refresh(client.salonId);
    return client;
  }

  async remove(id: string): Promise<void> {
    try {
      await this.api.write('DELETE', `/clients/${id}`);
    } catch (error) {
      this.toast.show(`Not deleted: ${apiError(error).message}`, 6000);
      throw error;
    }
    this.collection.setLocal((list) => list.filter((c) => c.id !== id));
  }

  reload(): Promise<void> {
    return this.collection.reload();
  }

  private salons(): SalonsStore {
    return this.injector.get(SalonsStore);
  }
}
