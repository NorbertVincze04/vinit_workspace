import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { ApiService, apiError } from '../../../core/api/api.service';
import { apiCollection } from '../../../core/api/api-collection';
import { ToastService } from '../../../core/services/toast.service';
import { uuid } from '../../../core/utils/id';
import { FinancesStore } from '../finances/finances.store';
import { PlansStore } from '../salons/plans.store';
import { SalonsStore } from '../salons/salons.store';
import { BillingWarning, LIVE, MrrPoint, PAYMENT_FIELD_MAP, Payment, SUBSCRIPTION_FIELD_MAP, Subscription } from './billing.model';

type Row = Record<string, unknown>;

/** Subscriptions, payments, MRR and billing warnings (all computed on the server). */
@Injectable({ providedIn: 'root' })
export class BillingStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly subs = apiCollection<Subscription>('/subscriptions', SUBSCRIPTION_FIELD_MAP, uuid);
  private readonly pays = apiCollection<Payment>('/payments', PAYMENT_FIELD_MAP, uuid);

  readonly subscriptions = this.subs.items;
  readonly payments = this.pays.items;
  readonly loaded = computed(() => this.subs.loaded() && this.pays.loaded());
  readonly warnings = signal<readonly BillingWarning[]>([]);
  readonly mrrHistory = signal<readonly MrrPoint[]>([]);

  readonly live = computed(() => this.subscriptions().filter((s) => LIVE.includes(s.status)));
  /** Monthly recurring revenue now (RON): active and past-due subscriptions. */
  readonly mrr = computed(() => this.subscriptions().reduce((sum, s) => sum + s.mrr, 0));
  readonly paying = computed(() => this.subscriptions().filter((s) => s.status === 'active' || s.status === 'past_due').length);
  readonly trialing = computed(() => this.subscriptions().filter((s) => s.status === 'trialing').length);
  readonly overdue = computed(() => this.payments().filter((p) => p.overdue));
  readonly overdueTotal = computed(() => this.overdue().reduce((sum, p) => sum + p.amount, 0));

  constructor() {
    void this.loadExtras();
  }

  async loadExtras(): Promise<void> {
    try {
      const [warnings, mrr] = await Promise.all([
        this.api.get<{ items: BillingWarning[] }>('/subscriptions/warnings'),
        this.api.get<{ items: MrrPoint[] }>('/metrics/mrr'),
      ]);
      this.warnings.set(warnings.items);
      this.mrrHistory.set(mrr.items);
    } catch {
      /* the lists show their own load errors */
    }
  }

  /** Everything again (after any change: money moves between lists). */
  async refresh(salonId?: string): Promise<void> {
    await Promise.all([this.subs.reload(), this.pays.reload(), this.loadExtras()]);
    const salons = this.injector.get(SalonsStore);
    if (salonId) void salons.refresh(salonId);
    else void salons.reload();
    void this.injector.get(PlansStore).reload();
  }

  async start(salonId: string, body: Row): Promise<void> {
    await this.loud(this.api.write('POST', `/salons/${salonId}/subscriptions`, body));
    await this.refresh(salonId);
  }

  async change(sub: Subscription, body: Row): Promise<void> {
    await this.loud(this.api.write('POST', `/subscriptions/${sub.id}/change`, body));
    await this.refresh(sub.salonId);
  }

  async updateNotes(sub: Subscription, patch: Row): Promise<void> {
    await this.loud(this.api.write('PATCH', `/subscriptions/${sub.id}`, patch));
    await this.refresh(sub.salonId);
  }

  async addPayment(body: Row): Promise<void> {
    await this.loud(this.api.write('POST', '/payments', body));
    await this.refresh(String(body['salonId']));
  }

  async updatePayment(p: Payment, body: Row): Promise<void> {
    await this.loud(this.api.write('PATCH', `/payments/${p.id}`, body));
    await this.refresh(p.salonId);
  }

  async removePayment(p: Payment): Promise<void> {
    await this.loud(this.api.write('DELETE', `/payments/${p.id}`));
    await this.refresh(p.salonId);
  }

  async markPaid(p: Payment, body: Row): Promise<void> {
    await this.loud(this.api.write('POST', `/payments/${p.id}/mark-paid`, body));
    await this.refresh(p.salonId);
    this.financesChanged();
  }

  async reopen(p: Payment): Promise<void> {
    await this.loud(this.api.write('POST', `/payments/${p.id}/reopen`));
    await this.refresh(p.salonId);
    this.financesChanged();
  }

  /** Creates the month's due payments for every paying subscription. Returns how many. */
  async generate(month: string): Promise<number> {
    const res = await this.loud(this.api.write<{ created: number }>('POST', '/payments/generate', { month }));
    await this.refresh();
    return res.created;
  }

  paymentFrom(row: Row): Payment {
    return this.pays.upsertRow(row);
  }

  subscriptionFrom(row: Row): Subscription {
    return this.subs.upsertRow(row);
  }

  /** The Finances tool shows the income entries that mark-paid creates. */
  private financesChanged(): void {
    void this.injector.get(FinancesStore).transactions.reload();
  }

  private loud<T>(request: Promise<T>): Promise<T> {
    return request.catch((error: unknown) => {
      this.toast.show(`Not saved: ${apiError(error).message}`, 6000);
      throw error;
    });
  }
}
