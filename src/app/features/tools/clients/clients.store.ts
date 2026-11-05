import { Injectable, computed, signal } from '@angular/core';
import { FINANCE } from '../../../core/data/finance.data';
import { EntityData } from '../../../core/models';
import { percent } from '../../../core/utils/format';
import { persistedCollection } from '../../../core/utils/persisted-collection';
import { matchesSearch } from '../../../core/utils/text';
import { ChipOption } from '../../../shared/ui';
import { CLIENT_STATUSES, Client, ClientFilters } from './clients.model';

/** Clients tool state. Saved in localStorage under "vinit.clients.v1". */
@Injectable({ providedIn: 'root' })
export class ClientsStore {
  private readonly collection = persistedCollection<Client>('clients.v1', 'c');

  readonly clients = this.collection.items;
  readonly filters = signal<ClientFilters>({ q: '', status: 'all', sort: 'newest' });

  readonly active = computed(() => this.clients().filter((c) => c.status === 'active'));
  /** Monthly recurring revenue from Active clients. */
  readonly mrr = computed(() => this.active().reduce((sum, c) => sum + (Number(c.price) || 0), 0));
  readonly breakEvenPercent = computed(() => percent(this.mrr(), FINANCE.monthlyCosts));

  readonly statusChips = computed<ChipOption[]>(() => {
    const list = this.clients();
    return [
      { value: 'all', label: 'All', count: list.length },
      ...CLIENT_STATUSES.map((s) => ({
        value: s.value,
        label: s.label,
        count: list.filter((c) => c.status === s.value).length,
      })),
    ];
  });

  readonly visible = computed(() => {
    const { q, status, sort } = this.filters();
    return this.clients()
      .filter((c) => status === 'all' || c.status === status)
      .filter((c) => matchesSearch(q, c.salon, c.owner, c.city, c.domain, c.phone, c.email))
      .sort((a, b) =>
        sort === 'name'
          ? a.salon.localeCompare(b.salon, 'ro')
          : String(b.createdAt).localeCompare(String(a.createdAt)),
      );
  });

  setFilters(patch: Partial<ClientFilters>): void {
    this.filters.update((f) => ({ ...f, ...patch }));
  }

  clearFilters(): void {
    this.filters.update((f) => ({ ...f, q: '', status: 'all' }));
  }

  add(data: EntityData<Client>): Client {
    return this.collection.add(data);
  }

  update(id: string, data: Partial<EntityData<Client>>): void {
    this.collection.update(id, data);
  }

  remove(id: string): void {
    this.collection.remove(id);
  }

  snapshot(): { clients: readonly Client[] } {
    return { clients: this.clients() };
  }

  /** Replaces all clients with a backup. Returns false for an invalid file. */
  importState(data: unknown): boolean {
    const list = (data as { clients?: unknown } | null)?.clients;
    if (!Array.isArray(list)) return false;
    this.collection.replaceAll(list as Client[]);
    return true;
  }
}
