import { Injectable, Injector, inject, signal } from '@angular/core';
import { ApiService } from '../../../core/api/api.service';
import { StorageService } from '../../../core/services/storage.service';
import { ClientsStore } from '../clients/clients.store';
import { LeadsStore } from '../leads/leads.store';
import { BillingStore } from '../subscriptions/billing.store';

export interface LegacyMoveResult {
  leads: number;
  salons: number;
  skipped: number;
  needsAddress: number;
  notes: string[];
}

const SOURCE_KEY = 'clients.v1';
const DONE_KEY = 'clients-import.v1';

/**
 * One-time move of the old Clients tool (saved in this browser) to the server, where each record
 * becomes a lead, or a client + salon + subscription (PLAN.md §4). The browser copy is kept.
 */
@Injectable({ providedIn: 'root' })
export class LegacyClientsService {
  private readonly storage = inject(StorageService);
  private readonly api = inject(ApiService);
  private readonly injector = inject(Injector);

  readonly movedAt = signal<string | null>(this.readDone());

  /** Records of the old tool in this browser. */
  records(): Record<string, unknown>[] {
    const v = this.storage.read(SOURCE_KEY);
    return Array.isArray(v) ? (v.filter((r) => r && typeof r === 'object' && typeof r.id === 'string') as Record<string, unknown>[]) : [];
  }

  /** How many become leads (lead/demo) and how many become salons (beta/active/paused). */
  counts(): { leads: number; salons: number } {
    const list = this.records();
    const leads = list.filter((r) => r['status'] === 'lead' || r['status'] === 'demo' || !r['status']).length;
    return { leads, salons: list.length - leads };
  }

  async move(): Promise<LegacyMoveResult> {
    const records = this.records().map((r) => ({
      id: String(r['id']),
      salon: String(r['salon'] ?? ''),
      owner: String(r['owner'] ?? ''),
      city: String(r['city'] ?? ''),
      phone: String(r['phone'] ?? ''),
      email: String(r['email'] ?? ''),
      domain: String(r['domain'] ?? ''),
      plan: String(r['plan'] ?? 'standard'),
      price: Number(r['price']) || 0,
      status: String(r['status'] ?? 'lead'),
      since: String(r['since'] ?? ''),
      notes: String(r['notes'] ?? ''),
      ...(typeof r['createdAt'] === 'string' ? { createdAt: r['createdAt'] } : {}),
    }));
    const result = await this.api.write<LegacyMoveResult>('POST', '/import/legacy-clients', { records });
    const now = new Date().toISOString();
    this.storage.write(DONE_KEY, now);
    this.movedAt.set(now);
    // Everything the move touched, read again.
    void this.injector.get(ClientsStore).reload();
    void this.injector.get(LeadsStore).reload();
    void this.injector.get(BillingStore).refresh(); // also salons and promotions
    return result;
  }

  private readDone(): string | null {
    const v = this.storage.read(DONE_KEY);
    return typeof v === 'string' ? v : null;
  }
}
