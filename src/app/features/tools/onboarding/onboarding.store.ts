import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { ApiService, apiError } from '../../../core/api/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { SalonsStore } from '../salons/salons.store';
import { Onboarding, TemplateItem } from './onboarding.model';
import { t } from '../../../core/i18n/i18n';

type Row = Record<string, unknown>;

/** Onboardings (the 48h clock is computed by the server) and the checklist template. */
@Injectable({ providedIn: 'root' })
export class OnboardingStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);

  readonly items = signal<readonly Onboarding[]>([]);
  readonly loaded = signal(false);

  readonly open = computed(() => this.items().filter((o) => o.status !== 'done'));
  readonly late = computed(() => this.open().filter((o) => o.late));
  readonly waiting = computed(() => this.open().filter((o) => !o.materialsReceivedAt));
  /** Average hours from materials to live, over finished onboardings. */
  readonly averageHours = computed(() => {
    const done = this.items().filter((o) => o.status === 'done' && o.hoursUsed !== null);
    return done.length ? Math.round(done.reduce((s, o) => s + (o.hoursUsed ?? 0), 0) / done.length) : null;
  });

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    try {
      this.items.set((await this.api.get<{ items: Onboarding[] }>('/onboardings')).items);
      this.loaded.set(true);
    } catch (error) {
      this.toast.show(t('Could not load onboardings: {error}', { error: apiError(error).message }), 6000);
    }
  }

  start(salonId: string, body: Row): Promise<Onboarding> {
    return this.write('POST', `/salons/${salonId}/onboarding`, body);
  }

  update(id: string, patch: Row): Promise<Onboarding> {
    return this.write('PATCH', `/onboardings/${id}`, patch);
  }

  setStep(stepId: string, patch: Row): Promise<Onboarding> {
    return this.write('PATCH', `/onboarding-steps/${stepId}`, patch);
  }

  addStep(id: string, body: Row): Promise<Onboarding> {
    return this.write('POST', `/onboardings/${id}/steps`, body);
  }

  removeStep(stepId: string): Promise<Onboarding> {
    return this.write('DELETE', `/onboarding-steps/${stepId}`);
  }

  goLive(id: string, wentLiveAt?: string): Promise<Onboarding> {
    return this.write('POST', `/onboardings/${id}/go-live`, wentLiveAt ? { wentLiveAt } : {});
  }

  async remove(id: string): Promise<void> {
    await this.loud(this.api.write('DELETE', `/onboardings/${id}`));
    this.items.update((list) => list.filter((o) => o.id !== id));
  }

  async template(): Promise<TemplateItem[]> {
    return (await this.api.get<{ items: TemplateItem[] }>('/onboarding-template')).items;
  }

  async saveTemplate(items: TemplateItem[]): Promise<void> {
    await this.loud(this.api.write('PUT', '/onboarding-template', { items }));
  }

  /** Writes, keeps the list in step with the server's answer and refreshes the salon row. */
  private async write(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: Row): Promise<Onboarding> {
    const res = await this.loud(this.api.write<{ item: Onboarding }>(method, path, body));
    const item = res.item;
    this.items.update((list) => (list.some((o) => o.id === item.id) ? list.map((o) => (o.id === item.id ? item : o)) : [...list, item]));
    void this.injector.get(SalonsStore).refresh(item.salonId);
    return item;
  }

  private loud<T>(request: Promise<T>): Promise<T> {
    return request.catch((error: unknown) => {
      this.toast.show(t('Not saved: {error}', { error: apiError(error).message }), 6000);
      throw error;
    });
  }
}
