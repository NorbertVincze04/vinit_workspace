import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { ApiService, apiError } from '../../../core/api/api.service';
import { fromApi } from '../../../core/api/api-fields';
import { apiCollection } from '../../../core/api/api-collection';
import { ToastService } from '../../../core/services/toast.service';
import { daysUntil } from '../../../core/utils/date';
import { uuid } from '../../../core/utils/id';
import { persistedSignal } from '../../../core/utils/persisted-signal';
import { matchesSearch } from '../../../core/utils/text';
import { ChipOption } from '../../../shared/ui';
import { ClientsStore } from '../clients/clients.store';
import { SalonsStore } from '../salons/salons.store';
import { ImportRow } from './leads.import';
import { LEAD_FIELD_MAP, LEAD_STAGES, Lead, LeadActivity, LeadFilters, LeadStage } from './leads.model';

type Row = Record<string, unknown>;

export interface LeadColumn {
  stage: LeadStage;
  label: string;
  hint: string;
  leads: Lead[];
}

/** Leads tool: the sales pipeline, saved on the server. */
@Injectable({ providedIn: 'root' })
export class LeadsStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly collection = apiCollection<Lead>('/leads', LEAD_FIELD_MAP, uuid);

  readonly leads = this.collection.items;
  readonly loaded = this.collection.loaded;
  readonly filters = signal<LeadFilters>({ q: '', due: 'all' });
  /** Board or list, remembered on this device. */
  readonly view = persistedSignal<'board' | 'list'>('leads.view', () => 'board', {
    validate: (v): v is 'board' | 'list' => v === 'board' || v === 'list',
  });

  /** Open leads whose follow-up date has passed. */
  readonly overdue = computed(() => this.leads().filter((l) => this.isOpen(l) && !!l.nextFollowUpOn && daysUntil(l.nextFollowUpOn) < 0));
  readonly dueToday = computed(() => this.leads().filter((l) => this.isOpen(l) && !!l.nextFollowUpOn && daysUntil(l.nextFollowUpOn) <= 0));

  readonly dueChips = computed<ChipOption[]>(() => {
    const open = this.leads().filter((l) => this.isOpen(l));
    return [
      { value: 'all', label: 'All', count: this.leads().length },
      { value: 'today', label: 'Follow up today', count: this.dueToday().length },
      { value: 'overdue', label: 'Overdue', count: this.overdue().length },
      { value: 'none', label: 'No follow-up set', count: open.filter((l) => !l.nextFollowUpOn).length },
    ];
  });

  readonly visible = computed(() => {
    const { q, due } = this.filters();
    return this.leads()
      .filter((l) => matchesSearch(q, l.businessName, l.contactName, l.city, l.phone, l.email, l.instagram, l.services))
      .filter((l) => {
        if (due === 'all') return true;
        if (!this.isOpen(l)) return false;
        if (due === 'none') return !l.nextFollowUpOn;
        if (!l.nextFollowUpOn) return false;
        const days = daysUntil(l.nextFollowUpOn);
        return due === 'overdue' ? days < 0 : days <= 0;
      });
  });

  readonly columns = computed<LeadColumn[]>(() => {
    const list = this.visible();
    return LEAD_STAGES.map((s) => ({
      stage: s.value,
      label: s.label,
      hint: s.hint,
      leads: list.filter((l) => l.stage === s.value).sort((a, b) => a.stagePosition - b.stagePosition || a.createdAt.localeCompare(b.createdAt)),
    }));
  });

  get(id: string): Lead | undefined {
    return this.collection.get(id);
  }

  setFilters(patch: Partial<LeadFilters>): void {
    this.filters.update((f) => ({ ...f, ...patch }));
  }

  clearFilters(): void {
    this.filters.set({ q: '', due: 'all' });
  }

  /** Not yet a salon, not lost: still needs follow-ups. */
  isOpen(l: Lead): boolean {
    return l.stage === 'contacted' || l.stage === 'replied' || l.stage === 'demo_booked';
  }

  create(body: Row): Promise<Lead> {
    return this.collection.create(body);
  }

  update(id: string, patch: Partial<Lead>): Promise<Lead> {
    return this.collection.save(id, patch);
  }

  async remove(id: string): Promise<void> {
    await this.loud(this.api.write('DELETE', `/leads/${id}`));
    this.collection.setLocal((list) => list.filter((l) => l.id !== id));
  }

  /**
   * Moves a card (drag and drop, or the stage picker). The board updates at once; the server's
   * answer (every card's position) replaces it, or the board reloads if the move was refused.
   * No position = last in the column.
   */
  async move(id: string, stage: LeadStage, position: number | undefined, extra: { lostReason?: string; lostNote?: string } = {}): Promise<boolean> {
    this.collection.setLocal((list) => {
      const lead = list.find((l) => l.id === id);
      if (!lead) return list;
      const column = list.filter((l) => l.stage === stage && l.id !== id).sort((a, b) => a.stagePosition - b.stagePosition);
      column.splice(Math.min(position ?? column.length, column.length), 0, { ...lead, stage });
      const positions = new Map(column.map((l, i) => [l.id, i]));
      return list.map((l) => (positions.has(l.id) ? { ...l, stage: l.id === id ? stage : l.stage, stagePosition: positions.get(l.id)! } : l));
    });
    try {
      const res = await this.api.write<{ items: Row[] }>('POST', `/leads/${id}/move`, { stage, ...(position === undefined ? {} : { position }), ...extra });
      this.collection.setLocal(() => res.items.map((r) => fromApi<Lead>(LEAD_FIELD_MAP, r)));
      return true;
    } catch (error) {
      this.toast.show(apiError(error).message, 6000);
      void this.collection.reload();
      return false;
    }
  }

  async detail(id: string): Promise<{ lead: Lead; activities: LeadActivity[] }> {
    const res = await this.api.get<{ item: Row; activities: LeadActivity[] }>(`/leads/${id}`);
    return { lead: this.collection.upsertRow(res.item), activities: res.activities };
  }

  async addActivity(id: string, body: { kind: string; body: string }): Promise<void> {
    await this.loud(this.api.write('POST', `/leads/${id}/activities`, body));
  }

  /** Lead → client + salon. Returns the new salon's id. */
  async convert(id: string, body: Row): Promise<string> {
    const res = await this.loud(this.api.write<{ lead: Row; salon: Row }>('POST', `/leads/${id}/convert`, body));
    this.collection.upsertRow(res.lead);
    void this.injector.get(SalonsStore).reload();
    void this.injector.get(ClientsStore).reload();
    return String(res.salon['id']);
  }

  async importRows(rows: ImportRow[]): Promise<{ created: number; skipped: string[] }> {
    const res = await this.loud(this.api.write<{ created: number; skipped: string[] }>('POST', '/leads/import', { rows }));
    await this.collection.reload();
    return res;
  }

  reload(): Promise<void> {
    return this.collection.reload();
  }

  private loud<T>(request: Promise<T>): Promise<T> {
    return request.catch((error: unknown) => {
      this.toast.show(`Not saved: ${apiError(error).message}`, 6000);
      throw error;
    });
  }
}
