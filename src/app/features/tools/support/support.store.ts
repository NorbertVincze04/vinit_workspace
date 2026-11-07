import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { ApiService, apiError } from '../../../core/api/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { SalonsStore } from '../salons/salons.store';
import { BillingStore } from '../subscriptions/billing.store';
import { OPEN_STATUSES, Sessions, Ticket, TimeEntry } from './support.model';

type Row = Record<string, unknown>;

/** Support tickets and logged time. */
@Injectable({ providedIn: 'root' })
export class SupportStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);

  readonly tickets = signal<readonly Ticket[]>([]);
  /** Time logged this month and last (for the summary). */
  readonly recentEntries = signal<readonly TimeEntry[]>([]);
  readonly loaded = signal(false);

  readonly open = computed(() => this.tickets().filter((t) => OPEN_STATUSES.includes(t.status)));
  readonly urgent = computed(() => this.open().filter((t) => t.priority === 'urgent' || t.priority === 'high'));

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    try {
      const from = new Date();
      from.setDate(1);
      from.setMonth(from.getMonth() - 1);
      const [tickets, entries] = await Promise.all([
        this.api.get<{ items: Ticket[] }>('/tickets'),
        this.api.get<{ items: TimeEntry[] }>('/time-entries', { from: from.toLocaleDateString('sv-SE') }),
      ]);
      this.tickets.set(tickets.items);
      this.recentEntries.set(entries.items);
      this.loaded.set(true);
    } catch (error) {
      this.toast.show(`Could not load support: ${apiError(error).message}`, 6000);
    }
  }

  async ticket(id: string): Promise<{ item: Ticket; entries: TimeEntry[] }> {
    return this.api.get<{ item: Ticket; entries: TimeEntry[] }>(`/tickets/${id}`);
  }

  sessions(salonId: string): Promise<Sessions> {
    return this.api.get<Sessions>(`/salons/${salonId}/sessions`);
  }

  async createTicket(body: Row): Promise<Ticket> {
    const res = await this.loud(this.api.write<{ item: Ticket }>('POST', '/tickets', body));
    this.done(res.item.salonId);
    return res.item;
  }

  async updateTicket(t: Ticket, patch: Row): Promise<Ticket> {
    const res = await this.loud(this.api.write<{ item: Ticket }>('PATCH', `/tickets/${t.id}`, patch));
    this.done(t.salonId);
    return res.item;
  }

  async removeTicket(t: Ticket): Promise<void> {
    await this.loud(this.api.write('DELETE', `/tickets/${t.id}`));
    this.done(t.salonId);
  }

  async logTime(salonId: string, body: Row): Promise<void> {
    await this.loud(this.api.write('POST', '/time-entries', { salonId, ...body }));
    this.done(salonId);
  }

  async removeEntry(e: TimeEntry): Promise<void> {
    await this.loud(this.api.write('DELETE', `/time-entries/${e.id}`));
    this.done(e.salonId);
  }

  /** Unbilled billable time → one extra-work payment (shows up in Subscriptions › Payments). */
  async billExtraWork(salonId: string): Promise<number> {
    const res = await this.loud(this.api.write<{ item: { amountBani: number } }>('POST', `/salons/${salonId}/bill-extra-work`, {}));
    this.done(salonId);
    void this.injector.get(BillingStore).refresh(salonId);
    return res.item.amountBani / 100;
  }

  private done(salonId: string): void {
    void this.reload();
    void this.injector.get(SalonsStore).refresh(salonId);
  }

  private loud<T>(request: Promise<T>): Promise<T> {
    return request.catch((error: unknown) => {
      this.toast.show(`Not saved: ${apiError(error).message}`, 6000);
      throw error;
    });
  }
}
