import { Injectable, inject, signal } from '@angular/core';
import { ApiService, apiError } from '../../../core/api/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { MonthKpis, Targets } from './kpis.model';

/** KPIs computed by the server from the history (closed months come from frozen snapshots). */
@Injectable({ providedIn: 'root' })
export class KpisStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly current = signal<MonthKpis | null>(null);
  readonly history = signal<readonly MonthKpis[]>([]);
  readonly targets = signal<Targets | null>(null);
  readonly loading = signal(false);

  async load(month: string): Promise<void> {
    this.loading.set(true);
    try {
      const [one, many] = await Promise.all([
        this.api.get<{ kpis: MonthKpis; targets: Targets }>('/kpis', { month }),
        this.api.get<{ items: MonthKpis[] }>('/kpis/history', { to: month }),
      ]);
      this.current.set(one.kpis);
      this.targets.set(one.targets);
      this.history.set(many.items);
    } catch (error) {
      this.toast.show(`Could not load the KPIs: ${apiError(error).message}`, 6000);
    } finally {
      this.loading.set(false);
    }
  }

  /** Recompute a finished month's frozen figures. */
  async rebuild(month: string): Promise<void> {
    try {
      await this.api.write('PUT', `/kpis/snapshots/${month}`);
      this.toast.show('Month recomputed');
      await this.load(month);
    } catch (error) {
      this.toast.show(`Not recomputed: ${apiError(error).message}`, 6000);
    }
  }
}
