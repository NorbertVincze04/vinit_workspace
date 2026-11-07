import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiError } from '../../../core/api/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDateTime } from '../../../core/utils/date';
import { renderMarkdown } from '../../../core/utils/markdown';
import {
  ButtonComponent,
  DialogComponent,
  EmptyStateComponent,
  MenuComponent,
  MenuItemComponent,
  PageHeaderComponent,
  SegmentedComponent,
} from '../../../shared/ui';
import { WIKI_CATEGORIES, WikiPage, WikiRevision, WikiStore, wikiCategory } from './wiki.store';

/** /tools/wiki/:slug — read a page, edit it (Markdown with live preview), see and restore old versions. */
@Component({
  selector: 'app-wiki-article',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, ButtonComponent, MenuComponent, MenuItemComponent, SegmentedComponent, DialogComponent, EmptyStateComponent],
  templateUrl: './wiki-article.component.html',
  styleUrl: './wiki-article.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WikiArticleComponent {
  readonly slug = input.required<string>();
  /** ?edit=1 opens the editor (new pages). */
  readonly edit = input<string | undefined>(undefined);

  private readonly store = inject(WikiStore);
  private readonly toast = inject(ToastService);

  protected readonly page = signal<WikiPage | null>(null);
  protected readonly error = signal('');
  protected readonly editing = signal(false);
  protected readonly draftTitle = signal('');
  protected readonly draftCategory = signal('other');
  protected readonly draftBody = signal('');
  protected readonly pane = signal('write');
  protected readonly saving = signal(false);
  protected readonly history = signal<WikiRevision[] | null>(null);
  protected readonly viewing = signal<WikiRevision | null>(null);

  protected readonly categories = WIKI_CATEGORIES;
  protected readonly panes = [
    { value: 'write', label: 'Write' },
    { value: 'preview', label: 'Preview' },
  ];
  protected readonly category = wikiCategory;
  protected readonly when = formatDateTime;
  protected readonly html = computed(() => renderMarkdown(this.page()?.bodyMd ?? ''));
  protected readonly previewHtml = computed(() => renderMarkdown(this.draftBody()));
  protected readonly dirty = computed(() => {
    const p = this.page();
    return !!p && (this.draftTitle() !== p.title || this.draftCategory() !== p.category || this.draftBody() !== p.bodyMd);
  });
  protected readonly render = renderMarkdown;

  constructor() {
    effect(
      () => {
        const slug = this.slug();
        const edit = this.edit();
        untracked(() => void this.load(slug, edit === '1'));
      },
      { allowSignalWrites: true },
    );
  }

  private async load(slug: string, edit: boolean): Promise<void> {
    try {
      this.page.set(await this.store.page(slug));
      this.error.set('');
      if (edit) this.startEdit();
    } catch (e) {
      this.error.set(apiError(e).message);
    }
  }

  protected startEdit(): void {
    const p = this.page();
    if (!p) return;
    this.draftTitle.set(p.title);
    this.draftCategory.set(p.category);
    this.draftBody.set(p.bodyMd);
    this.pane.set('write');
    this.editing.set(true);
  }

  protected cancel(): void {
    if (this.dirty() && !confirm('Discard your changes?')) return;
    this.editing.set(false);
  }

  protected async save(): Promise<void> {
    const p = this.page();
    if (!p || !this.draftTitle().trim()) return;
    this.saving.set(true);
    try {
      const saved = await this.store.save(p.slug, {
        title: this.draftTitle().trim(),
        category: this.draftCategory(),
        bodyMd: this.draftBody(),
        baseRevision: p.revision,
      });
      this.page.set(saved);
      this.editing.set(false);
      this.toast.show(saved.revision > p.revision ? `Saved as version ${saved.revision}` : 'No changes');
    } catch {
      /* the store showed why (e.g. someone else saved meanwhile); the draft stays */
    } finally {
      this.saving.set(false);
    }
  }

  protected input(target: 'title' | 'body', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    if (target === 'title') this.draftTitle.set(value);
    else this.draftBody.set(value);
  }

  protected async openHistory(): Promise<void> {
    const p = this.page();
    if (!p) return;
    try {
      this.history.set(await this.store.revisions(p.slug));
    } catch (e) {
      this.toast.show(`Could not load the history: ${apiError(e).message}`, 6000);
    }
  }

  protected async restore(rev: WikiRevision, dialog: DialogComponent): Promise<void> {
    const p = this.page();
    if (!p) return;
    try {
      this.page.set(await this.store.restore(p.slug, rev.revision));
      this.toast.show(`Version ${rev.revision} is back (saved as a new version)`);
      dialog.close();
    } catch {
      /* toast shown */
    }
  }

  protected async toggleArchive(): Promise<void> {
    const p = this.page();
    if (!p) return;
    try {
      this.page.set(await this.store.archive(p.slug, !p.archived));
      this.toast.show(p.archived ? 'Back in the wiki' : 'Archived (find it under “Show archived pages”)');
    } catch {
      /* toast shown */
    }
  }
}
