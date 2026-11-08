import { Injectable, inject, signal } from '@angular/core';
import { ApiService, apiError } from '../../../core/api/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { Deadline, localizeDeadline } from './calendar.model';
import { t } from '../../../core/i18n/i18n';

type Row = Record<string, unknown>;

/** Deadlines: manual ones and those generated from domains, contracts and trials. */
@Injectable({ providedIn: 'root' })
export class CalendarStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  /** Open deadlines in the next 30 days plus anything late (Overview, calendar). */
  readonly upcoming = signal<readonly Deadline[]>([]);

  constructor() {
    void this.loadUpcoming();
  }

  async loadUpcoming(days = 30): Promise<void> {
    try {
      this.upcoming.set((await this.api.get<{ items: Deadline[] }>('/deadlines/upcoming', { days })).items.map(localizeDeadline));
    } catch {
      /* the page shows its own errors */
    }
  }

  async range(from: string, to: string): Promise<Deadline[]> {
    try {
      return (await this.api.get<{ items: Deadline[] }>('/deadlines', { from, to })).items.map(localizeDeadline);
    } catch (error) {
      this.toast.show(t('Could not load deadlines: {error}', { error: apiError(error).message }), 6000);
      return [];
    }
  }

  async create(body: Row): Promise<void> {
    await this.write('POST', '/deadlines', body);
  }

  async update(id: string, patch: Row): Promise<void> {
    await this.write('PATCH', `/deadlines/${id}`, patch);
  }

  /** Marks it done; returns the next date for a repeating one. */
  async done(d: Deadline): Promise<string | null> {
    const res = await this.write<{ next: Deadline | null }>('POST', `/deadlines/${d.id}/done`);
    return res.next?.dueOn ?? null;
  }

  async remove(d: Deadline): Promise<void> {
    await this.write('DELETE', `/deadlines/${d.id}`);
  }

  private async write<T = unknown>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: Row): Promise<T> {
    try {
      const res = await this.api.write<T>(method, path, body);
      void this.loadUpcoming();
      return res;
    } catch (error) {
      this.toast.show(t('Not saved: {error}', { error: apiError(error).message }), 6000);
      throw error;
    }
  }
}
