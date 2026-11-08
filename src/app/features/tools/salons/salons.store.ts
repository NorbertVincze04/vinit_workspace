import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { ApiService, apiError } from '../../../core/api/api.service';
import { apiCollection } from '../../../core/api/api-collection';
import { ToastService } from '../../../core/services/toast.service';
import { uuid } from '../../../core/utils/id';
import { matchesSearch } from '../../../core/utils/text';
import { ChipOption } from '../../../shared/ui';
import { ClientsStore } from '../clients/clients.store';
import {
  SALON_FIELD_MAP,
  SALON_STATUSES,
  Salon,
  SalonFilters,
  SalonOverview,
  SalonStatus,
  TimelineEntry,
} from './salons.model';
import { t } from '../../../core/i18n/i18n';

type Row = Record<string, unknown>;

/** Salons: the central record every other tool links to. */
@Injectable({ providedIn: 'root' })
export class SalonsStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly collection = apiCollection<Salon>('/salons', SALON_FIELD_MAP, uuid);

  readonly salons = this.collection.items;
  readonly loaded = this.collection.loaded;
  readonly filters = signal<SalonFilters>({ q: '', status: 'all' });

  readonly active = computed(() => this.salons().filter((s) => s.status === 'active'));
  readonly trial = computed(() => this.salons().filter((s) => s.status === 'trial'));

  readonly statusChips = computed<ChipOption[]>(() => {
    const list = this.salons();
    return [
      { value: 'all', label: 'All', count: list.length },
      ...SALON_STATUSES.map((s) => ({ value: s.value, label: s.label, count: list.filter((x) => x.status === s.value).length })),
    ];
  });

  readonly visible = computed(() => {
    const { q, status } = this.filters();
    return this.salons()
      .filter((s) => status === 'all' || s.status === status)
      .filter((s) => matchesSearch(q, s.name, s.city, s.clientName, s.primaryDomain, s.tenantSlug, s.clientPhone, s.clientEmail))
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  });

  get(id: string): Salon | undefined {
    return this.collection.get(id);
  }

  setFilters(patch: Partial<SalonFilters>): void {
    this.filters.update((f) => ({ ...f, ...patch }));
  }

  clearFilters(): void {
    this.filters.set({ q: '', status: 'all' });
  }

  async create(body: Row): Promise<Salon> {
    const salon = await this.collection.create(body);
    this.clients().reload();
    return salon;
  }

  async update(id: string, patch: Partial<Salon>): Promise<Salon> {
    return this.collection.save(id, patch);
  }

  async setStatus(id: string, body: { status: string; changedOn?: string | null; reason?: string }): Promise<Salon> {
    const res = await this.loud(this.api.write<{ item: Row }>('POST', `/salons/${id}/status`, body));
    const salon = this.collection.upsertRow(res.item);
    this.clients().reload();
    return salon;
  }

  async remove(id: string): Promise<void> {
    await this.loud(this.api.write('DELETE', `/salons/${id}`));
    this.collection.setLocal((list) => list.filter((s) => s.id !== id));
    this.clients().reload();
  }

  /** Reads one salon again (after a change made elsewhere: client edit, domain, subscription…). */
  async refresh(id: string): Promise<void> {
    try {
      const res = await this.api.get<{ item: Row }>(`/salons/${id}`);
      this.collection.upsertRow(res.item);
    } catch {
      /* the list reloads next time; nothing to tell the user */
    }
  }

  reload(): Promise<void> {
    return this.collection.reload();
  }

  overview(id: string): Promise<SalonOverview> {
    return this.api.get<SalonOverview>(`/salons/${id}/overview`);
  }

  async timeline(id: string): Promise<TimelineEntry[]> {
    return (await this.api.get<{ items: TimelineEntry[] }>(`/salons/${id}/timeline`, { limit: 200 })).items;
  }

  // ---- domains ----

  async addDomain(salonId: string, body: Row): Promise<void> {
    await this.loud(this.api.write('POST', `/salons/${salonId}/domains`, body));
    await this.refresh(salonId);
  }

  async updateDomain(salonId: string, domainId: string, body: Row): Promise<void> {
    await this.loud(this.api.write('PATCH', `/domains/${domainId}`, body));
    await this.refresh(salonId);
  }

  async removeDomain(salonId: string, domainId: string): Promise<void> {
    await this.loud(this.api.write('DELETE', `/domains/${domainId}`));
    await this.refresh(salonId);
  }

  statusCount(status: SalonStatus): number {
    return this.salons().filter((s) => s.status === status).length;
  }

  /** Shows the server's message, then rethrows so the caller can stop. */
  private loud<T>(request: Promise<T>): Promise<T> {
    return request.catch((error: unknown) => {
      this.toast.show(t('Not saved: {error}', { error: apiError(error).message }), 6000);
      throw error;
    });
  }

  // Created lazily: ClientsStore also reads salons.
  private clients(): ClientsStore {
    return this.injector.get(ClientsStore);
  }
}
