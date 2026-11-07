import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { formatDate } from '../../../core/utils/date';
import {
  ButtonComponent,
  ChipGroupComponent,
  ChipOption,
  EmptyStateComponent,
  FormDialogComponent,
  FormValues,
  IconComponent,
  PageHeaderComponent,
  TextFieldComponent,
  asString,
} from '../../../shared/ui';
import { WIKI_CATEGORIES, WikiListItem, WikiStore, wikiCategory } from './wiki.store';

/** Wiki tool: how-tos and SOPs, searchable (diacritics ignored). */
@Component({
  selector: 'app-wiki-page',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, ButtonComponent, IconComponent, TextFieldComponent, ChipGroupComponent, EmptyStateComponent, FormDialogComponent],
  template: `
    <app-page-header title="Wiki" description="How we do things: onboarding steps, deploys, the JSON config, backups, sales scripts.">
      <div pageActions>
        <button appButton variant="primary" type="button" (click)="creating.set(true)"><app-icon name="plus" [size]="16" /> New page</button>
      </div>
    </app-page-header>

    <div class="toolbar">
      <app-text-field class="grow" type="search" label="Search the wiki" labelMode="hidden" placeholder="Search words (diacritics don't matter)" [value]="q()" (valueChange)="q.set($event)" />
      <app-chip-group label="Category" [options]="chips" [(value)]="category" />
    </div>

    @if (loading() && !items().length) {
      <app-empty-state heading="Loading…" text="" />
    } @else if (!items().length) {
      <app-empty-state [heading]="q() ? 'Nothing found' : 'No pages here'" [text]="q() ? 'Try other words.' : 'Write the first how-to for this category.'" />
    } @else {
      <ul class="pages">
        @for (p of items(); track p.id) {
          <li>
            <a [routerLink]="['/tools/wiki', p.slug]">
              <span class="title">{{ p.title }}</span>
              <span class="meta">{{ categoryLabel(p.category) }} · updated {{ date(p.updatedAt.slice(0, 10)) }}{{ p.updatedByName ? ' by ' + p.updatedByName : '' }}</span>
              <span class="excerpt" [innerHTML]="snippet(p)"></span>
            </a>
          </li>
        }
      </ul>
    }
    <p class="foot">
      <button type="button" class="link" (click)="archived.set(!archived())">{{ archived() ? 'Back to the pages' : 'Show archived pages' }}</button>
    </p>

    @if (creating()) {
      <app-form-dialog heading="New page" [fields]="fields" saveLabel="Create and edit" (saved)="create($event)" (closed)="creating.set(false)" />
    }
  `,
  styles: `
    .pages { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .pages a { display: grid; gap: 4px; padding: 14px 16px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg);
      color: inherit; text-decoration: none; }
    .pages a:hover { border-color: var(--line-strong); }
    .title { font-weight: 600; font-size: 15px; }
    .meta { font-size: 12.5px; color: var(--muted); }
    .excerpt { font-size: 13.5px; color: var(--muted); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .excerpt ::ng-deep mark { background: var(--tone-warn-bg); color: inherit; padding: 0 2px; border-radius: 3px; }
    .foot { margin-top: 16px; }
    .link { font: inherit; font-size: 13.5px; color: var(--main); background: none; border: 0; padding: 0; cursor: pointer; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WikiPageComponent {
  private readonly store = inject(WikiStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly q = signal('');
  protected readonly category = signal('all');
  protected readonly archived = signal(false);
  protected readonly items = signal<WikiListItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly creating = signal(false);
  protected readonly chips: ChipOption[] = [{ value: 'all', label: 'All' }, ...WIKI_CATEGORIES];
  protected readonly fields = [
    { key: 'title', label: 'Title', type: 'text' as const, required: true, maxLength: 200, span: 'full' as const, placeholder: 'e.g. How to connect a domain' },
    { key: 'category', label: 'Category', type: 'select' as const, default: 'other', options: WIKI_CATEGORIES },
  ];
  protected readonly date = formatDate;
  protected readonly categoryLabel = wikiCategory;

  constructor() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    effect(
      () => {
        const q = this.q();
        const c = this.category();
        const a = this.archived();
        clearTimeout(timer);
        // Wait for a pause in typing before searching.
        timer = setTimeout(() => untracked(() => void this.load(q, c, a)), q ? 250 : 0);
      },
      { allowSignalWrites: true },
    );
  }

  private async load(q: string, c: string, a: boolean): Promise<void> {
    this.loading.set(true);
    this.items.set(await this.store.list(q, c, a));
    this.loading.set(false);
  }

  /** Search hit with the matched words highlighted, or the start of the page. */
  protected snippet(p: WikiListItem): string {
    const text = (p.headline || p.excerpt || '').replace(/[#*`>|_\[\]()]/g, ' ');
    const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return safe.replace(/«/g, '<mark>').replace(/»/g, '</mark>');
  }

  protected async create(v: FormValues): Promise<void> {
    try {
      const page = await this.store.create({ title: asString(v['title']), category: asString(v['category']) || 'other' });
      void this.router.navigate(['/tools/wiki', page.slug], { queryParams: { edit: 1 } });
    } catch {
      this.toast.show('The page was not created.');
    }
  }
}
