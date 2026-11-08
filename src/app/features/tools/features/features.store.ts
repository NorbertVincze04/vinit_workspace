import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService, apiError } from '../../../core/api/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { FeatureRequest, RoadmapStepRow } from './features.model';
import { t } from '../../../core/i18n/i18n';

type Row = Record<string, unknown>;

/** Feature requests, ranked by the MRR of the salons that asked, then votes. */
@Injectable({ providedIn: 'root' })
export class FeaturesStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly items = signal<readonly FeatureRequest[]>([]);
  readonly steps = signal<readonly RoadmapStepRow[]>([]);
  readonly loaded = signal(false);
  readonly open = computed(() => this.items().filter((r) => r.status === 'new' || r.status === 'planned' || r.status === 'in_progress'));

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    try {
      const [items, steps] = await Promise.all([
        this.api.get<{ items: FeatureRequest[] }>('/feature-requests'),
        this.steps().length ? Promise.resolve({ items: this.steps() as RoadmapStepRow[] }) : this.api.get<{ items: RoadmapStepRow[] }>('/roadmap-steps'),
      ]);
      this.items.set(items.items);
      this.steps.set(steps.items);
      this.loaded.set(true);
    } catch (error) {
      this.toast.show(t('Could not load feature requests: {error}', { error: apiError(error).message }), 6000);
    }
  }

  get(id: string): Promise<FeatureRequest> {
    return this.api.get<{ item: FeatureRequest }>(`/feature-requests/${id}`).then((r) => r.item);
  }

  create(body: Row): Promise<FeatureRequest> {
    return this.write('POST', '/feature-requests', body);
  }

  update(id: string, patch: Row): Promise<FeatureRequest> {
    return this.write('PATCH', `/feature-requests/${id}`, patch);
  }

  async remove(id: string): Promise<void> {
    await this.loud(this.api.write('DELETE', `/feature-requests/${id}`));
    this.items.update((list) => list.filter((r) => r.id !== id));
  }

  vote(id: string, body: Row): Promise<FeatureRequest> {
    return this.write('POST', `/feature-requests/${id}/votes`, body);
  }

  unvote(voteId: string): Promise<FeatureRequest> {
    return this.write('DELETE', `/feature-votes/${voteId}`);
  }

  /** A change-request ticket becomes a feature request (with the salon's vote). */
  fromTicket(ticketId: string): Promise<FeatureRequest> {
    return this.write('POST', `/tickets/${ticketId}/to-feature-request`);
  }

  private async write(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: Row): Promise<FeatureRequest> {
    const res = await this.loud(this.api.write<{ item: FeatureRequest }>(method, path, body));
    void this.reload();
    return res.item;
  }

  private loud<T>(request: Promise<T>): Promise<T> {
    return request.catch((error: unknown) => {
      this.toast.show(t('Not saved: {error}', { error: apiError(error).message }), 6000);
      throw error;
    });
  }
}
