import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService, apiError } from '../../../core/api/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { Plan, Promotion, planFromApi, promotionFromApi } from './salons.model';
import { t } from '../../../core/i18n/i18n';

/** Plans (Standard, Premium, Custom) and promotions (Early Bird, beta…), seeded on the server. */
@Injectable({ providedIn: 'root' })
export class PlansStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly plans = signal<readonly Plan[]>([]);
  readonly promotions = signal<readonly Promotion[]>([]);
  readonly loaded = signal(false);

  readonly earlyBird = computed(() => this.promotions().find((p) => p.code === 'early_bird') ?? null);
  /** Early Bird places left (50 minus salons that got it; beta salons don't count). */
  readonly earlyBirdLeft = computed(() => {
    const p = this.earlyBird();
    return p?.maxSalons ? Math.max(0, p.maxSalons - p.used) : null;
  });

  constructor() {
    void this.reload();
  }

  plan(id: string | null | undefined): Plan | undefined {
    return id ? this.plans().find((p) => p.id === id) : undefined;
  }

  promotion(id: string | null | undefined): Promotion | undefined {
    return id ? this.promotions().find((p) => p.id === id) : undefined;
  }

  async reload(): Promise<void> {
    try {
      const [plans, promotions] = await Promise.all([
        this.api.get<{ items: Record<string, unknown>[] }>('/plans'),
        this.api.get<{ items: Record<string, unknown>[] }>('/promotions'),
      ]);
      this.plans.set(plans.items.map(planFromApi));
      this.promotions.set(promotions.items.map(promotionFromApi));
      this.loaded.set(true);
    } catch (error) {
      this.toast.show(t('Could not load plans: {error}', { error: apiError(error).message }), 6000);
    }
  }
}
