import { Injectable, inject } from '@angular/core';
import { ApiService, apiError } from '../../../core/api/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { t } from '../../../core/i18n/i18n';

export type WikiCategory = 'onboarding' | 'deploy' | 'json_schema' | 'backups' | 'sales' | 'other';

export const WIKI_CATEGORIES: readonly { value: WikiCategory; label: string }[] = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'deploy', label: 'Deploy' },
  { value: 'json_schema', label: 'JSON config' },
  { value: 'backups', label: 'Backups' },
  { value: 'sales', label: 'Sales' },
  { value: 'other', label: 'Other' },
];
export const wikiCategory = (c: string): string => t(WIKI_CATEGORIES.find((x) => x.value === c)?.label ?? c);

export interface WikiListItem {
  id: string;
  slug: string;
  title: string;
  category: WikiCategory;
  revision: number;
  archived: boolean;
  updatedAt: string;
  updatedByName: string | null;
  excerpt: string;
  /** Search hit with the matched words between « ». */
  headline?: string;
}

export interface WikiPage extends Omit<WikiListItem, 'excerpt' | 'headline'> {
  bodyMd: string;
}

export interface WikiRevision {
  revision: number;
  title: string;
  bodyMd: string;
  editedAt: string;
  editedByName: string | null;
}

/** Wiki pages: list/search, read, save (with conflict check), history, restore, archive. */
@Injectable({ providedIn: 'root' })
export class WikiStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  async list(q: string, category: string, archived = false): Promise<WikiListItem[]> {
    try {
      const params: Record<string, string> = { archived: String(archived) };
      if (q.trim()) params['q'] = q.trim();
      if (category !== 'all') params['category'] = category;
      return (await this.api.get<{ items: WikiListItem[] }>('/wiki', params)).items;
    } catch (error) {
      this.toast.show(t('Could not load the wiki: {error}', { error: apiError(error).message }), 6000);
      return [];
    }
  }

  async page(slug: string): Promise<WikiPage> {
    return (await this.api.get<{ item: WikiPage }>(`/wiki/${slug}`)).item;
  }

  create(body: { title: string; category: string; bodyMd?: string }): Promise<WikiPage> {
    return this.write('POST', '/wiki', body);
  }

  save(slug: string, body: { title: string; category: string; bodyMd: string; baseRevision: number }): Promise<WikiPage> {
    return this.write('PUT', `/wiki/${slug}`, body);
  }

  archive(slug: string, archived: boolean): Promise<WikiPage> {
    return this.write('POST', `/wiki/${slug}/archive`, { archived });
  }

  async revisions(slug: string): Promise<WikiRevision[]> {
    return (await this.api.get<{ items: WikiRevision[] }>(`/wiki/${slug}/revisions`)).items;
  }

  restore(slug: string, revision: number): Promise<WikiPage> {
    return this.write('POST', `/wiki/${slug}/restore/${revision}`);
  }

  private async write(method: 'POST' | 'PUT', path: string, body?: unknown): Promise<WikiPage> {
    try {
      return (await this.api.write<{ item: WikiPage }>(method, path, body)).item;
    } catch (error) {
      this.toast.show(t('Not saved: {error}', { error: apiError(error).message }), 9000);
      throw error;
    }
  }
}
