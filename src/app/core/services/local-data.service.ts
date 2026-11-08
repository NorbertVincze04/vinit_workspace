import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { FilesStore } from '../../features/tools/files/files.store';
import { StoredFile } from '../../features/tools/files/files.model';
import { FinancesStore } from '../../features/tools/finances/finances.store';
import { FinanceCollection } from '../../features/tools/finances/finances.data';
import { MarketingStore } from '../../features/tools/marketing/marketing.store';
import { RoadmapStore } from '../../features/tools/roadmap/roadmap.store';
import { TasksStore } from '../../features/tools/tasks/tasks.store';
import { isMonthKey } from '../utils/date';
import { FileStorageService } from './file-storage.service';
import { PlanCalendarService } from './plan-calendar.service';
import { StorageService } from './storage.service';
import { t } from '../i18n/i18n';

/** What this browser still holds from before the server existed. */
export interface LocalDataSummary {
  tasks: number;
  goals: number;
  finances: number;
  posts: number;
  roadmapSteps: number;
  files: number;
  /** Total number of records (0 = nothing to move). */
  total: number;
}

export interface MoveResult {
  files: { moved: number; skipped: string[] };
}

const FINANCE_KEYS: Record<FinanceCollection, string> = {
  accounts: 'finances.accounts.v1',
  holdings: 'finances.holdings.v1',
  recurring: 'finances.recurring.v1',
  transactions: 'finances.transactions.v1',
  budgets: 'finances.budgets.v1',
};
/** Parents before children, so transactions keep their links. */
const FINANCE_ORDER: FinanceCollection[] = ['accounts', 'holdings', 'recurring', 'transactions', 'budgets'];
const DONE_KEY = 'local-import.v1';

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * One-time move of the data saved in this browser (localStorage + IndexedDB files) to the server.
 * Uses each store's normal import, so the data goes through the same validation as a backup.
 * The browser copy is left in place (nothing is deleted). The old Clients list has its own move
 * (LegacyClientsService), because its records become leads, salons and subscriptions.
 */
@Injectable({ providedIn: 'root' })
export class LocalDataService {
  private readonly storage = inject(StorageService);
  private readonly fileBytes = inject(FileStorageService);
  private readonly api = inject(ApiService);
  private readonly tasks = inject(TasksStore);
  private readonly finances = inject(FinancesStore);
  private readonly marketing = inject(MarketingStore);
  private readonly roadmap = inject(RoadmapStore);
  private readonly files = inject(FilesStore);
  private readonly plan = inject(PlanCalendarService);

  /** Set after a successful move (on this browser). */
  readonly movedAt = signal<string | null>(this.readDone());

  summary(): LocalDataSummary {
    const tasks = this.storage.read('tasks.v1') as { tasks?: unknown; goals?: unknown } | null;
    const roadmap = this.storage.read('roadmap.v1') as { done?: Record<string, boolean> } | null;
    const s = {
      tasks: list(tasks?.tasks).length,
      goals: list(tasks?.goals).length,
      finances: FINANCE_ORDER.reduce((n, c) => n + list(this.storage.read(FINANCE_KEYS[c])).length, 0),
      posts: list(this.storage.read('marketing.v1')).length,
      roadmapSteps: Object.values(roadmap?.done ?? {}).filter(Boolean).length,
      files: list(this.storage.read('appendices.v1')).length,
    };
    return { ...s, total: s.tasks + s.goals + s.finances + s.posts + s.roadmapSteps + s.files };
  }

  /**
   * Replaces the server's Tasks, Finances, Marketing and Roadmap data with this browser's copy
   * (only the tools that have local data) and uploads the local files.
   */
  async moveToServer(): Promise<MoveResult> {
    const tasks = this.storage.read('tasks.v1');
    if (tasks && typeof tasks === 'object') this.tasks.importState(tasks);
    const start = this.storage.read('plan.start');
    if (isMonthKey(start)) this.plan.setStart(start);

    for (const name of FINANCE_ORDER) {
      const items = this.storage.read(FINANCE_KEYS[name]);
      if (Array.isArray(items)) void this.finances.collection(name).replaceAll(items as never[]).catch(() => undefined);
    }
    const rates = this.storage.read('finances.rates.v1') as { eur?: number; usd?: number } | null;
    if (rates && Number(rates.eur) > 0 && Number(rates.usd) > 0) this.finances.setRates({ eur: Number(rates.eur), usd: Number(rates.usd) });

    const posts = this.storage.read('marketing.v1');
    if (Array.isArray(posts)) this.marketing.importState({ posts });

    const roadmap = this.storage.read('roadmap.v1');
    if (roadmap) this.roadmap.importState(roadmap);

    // Wait for everything above to reach the server before uploading files.
    await this.api.settled();
    if (this.api.lastError()) throw new Error(this.api.lastError() ?? 'Some data could not be saved.');

    const result: MoveResult = { files: { moved: 0, skipped: [] } };
    for (const meta of list(this.storage.read('appendices.v1')) as StoredFile[]) {
      try {
        const blob = await this.fileBytes.get(meta.id);
        if (!blob) {
          result.files.skipped.push(t('{name}: not stored in this browser any more', { name: meta.name }));
          continue;
        }
        await this.files.send(blob, { id: meta.id, name: meta.name, createdAt: meta.createdAt });
        result.files.moved++;
      } catch (error) {
        const conflict = (error as { status?: number }).status === 409;
        result.files.skipped.push(`${meta.name}: ${conflict ? 'already on the server' : 'upload failed'}`);
      }
    }

    const now = new Date().toISOString();
    this.storage.write(DONE_KEY, now);
    this.movedAt.set(now);
    return result;
  }

  private readDone(): string | null {
    const v = this.storage.read(DONE_KEY);
    return typeof v === 'string' ? v : null;
  }
}
