import { Injectable, Injector, inject, signal } from '@angular/core';
import { ApiService, apiError } from '../../../core/api/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { OnboardingStore } from '../onboarding/onboarding.store';
import { SalonsStore } from '../salons/salons.store';
import { Attachment } from './components/attachments/attachments.component';
import { ComplianceRow, Contract } from './contracts.model';

type Row = Record<string, unknown>;

/** Contracts, DPAs and the compliance view. */
@Injectable({ providedIn: 'root' })
export class ContractsStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);

  readonly items = signal<readonly Contract[]>([]);
  readonly compliance = signal<readonly ComplianceRow[]>([]);
  readonly loaded = signal(false);

  constructor() {
    void this.reload();
  }

  async reload(): Promise<void> {
    try {
      const [items, compliance] = await Promise.all([
        this.api.get<{ items: Contract[] }>('/contracts'),
        this.api.get<{ items: ComplianceRow[] }>('/contracts/compliance'),
      ]);
      this.items.set(items.items);
      this.compliance.set(compliance.items);
      this.loaded.set(true);
    } catch (error) {
      this.toast.show(`Could not load contracts: ${apiError(error).message}`, 6000);
    }
  }

  get(id: string): Promise<{ item: Contract; files: Attachment[] }> {
    return this.api.get(`/contracts/${id}`);
  }

  create(body: Row): Promise<Contract> {
    return this.write('POST', '/contracts', body);
  }

  update(id: string, patch: Row): Promise<Contract> {
    return this.write('PATCH', `/contracts/${id}`, patch);
  }

  async remove(c: Contract): Promise<void> {
    await this.loud(this.api.write('DELETE', `/contracts/${c.id}`));
    void this.reload();
  }

  private async write(method: 'POST' | 'PATCH', path: string, body: Row): Promise<Contract> {
    const res = await this.loud(this.api.write<{ item: Contract }>(method, path, body));
    void this.reload();
    // Signing a subscription contract stamps the salon and starts its onboarding.
    void this.injector.get(SalonsStore).refresh(res.item.salonId);
    void this.injector.get(OnboardingStore).reload();
    return res.item;
  }

  private loud<T>(request: Promise<T>): Promise<T> {
    return request.catch((error: unknown) => {
      this.toast.show(`Not saved: ${apiError(error).message}`, 6000);
      throw error;
    });
  }
}
