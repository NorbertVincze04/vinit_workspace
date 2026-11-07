import { ChangeDetectionStrategy, Component, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { ACTIVITY_LINK, OVERVIEW_LINK, TOOLS } from '../../core/data/tools.data';
import { DialogComponent, IconComponent } from '../../shared/ui';

export interface SearchHit {
  type: 'tool' | 'salon' | 'client' | 'lead' | 'ticket' | 'contract' | 'feature' | 'wiki';
  id: string;
  title: string;
  sub: string;
  link: string;
}

const TYPE_LABELS: Record<SearchHit['type'], string> = {
  tool: 'Go to',
  salon: 'Salons',
  client: 'Clients',
  lead: 'Leads',
  ticket: 'Tickets',
  contract: 'Contracts',
  feature: 'Feature requests',
  wiki: 'Wiki',
};

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Opens the search from anywhere (buttons, Ctrl+K). */
@Injectable({ providedIn: 'root' })
export class SearchService {
  readonly open = signal(false);
}

/** One box to find salons, clients, leads, tickets (T-12), contracts, feature requests, wiki pages and tools. */
@Component({
  selector: 'app-search-palette',
  standalone: true,
  imports: [DialogComponent, IconComponent],
  host: { '(document:keydown)': 'onGlobalKey($event)' },
  template: `
    @if (search.open()) {
      <app-dialog #dlg heading="Search" size="md" (closed)="closed()">
        <div class="box">
          <app-icon name="search" [size]="18" />
          <input
            #box
            class="input"
            type="search"
            autofocus
            autocomplete="off"
            placeholder="Salon, client, lead, T-12, contract, wiki…"
            aria-label="Search the workspace"
            role="combobox"
            aria-controls="search-results"
            [attr.aria-expanded]="hits().length > 0"
            [attr.aria-activedescendant]="hits().length ? 'hit-' + active() : null"
            [value]="query()"
            (input)="type(box.value)"
            (keydown)="onKey($event, dlg)"
          />
        </div>
        <div id="search-results" role="listbox" aria-label="Results" class="results">
          @for (g of groups(); track g.type) {
            <h3>{{ g.label }}</h3>
            @for (h of g.hits; track h.type + h.id) {
              <button
                type="button"
                role="option"
                class="hit"
                [id]="'hit-' + h.index"
                [class.active]="h.index === active()"
                [attr.aria-selected]="h.index === active()"
                (mouseenter)="active.set(h.index)"
                (click)="go(h, dlg)"
              >
                <span class="title">{{ h.title }}</span>
                @if (h.sub) {
                  <span class="sub">{{ h.sub }}</span>
                }
              </button>
            }
          } @empty {
            @if (query().trim().length && !loading()) {
              <p class="muted">Nothing found for “{{ query().trim() }}”.</p>
            } @else if (!query().trim().length) {
              <p class="muted">Type to search. Every word has to match; accents don't matter. Ctrl+K opens this from anywhere.</p>
            }
          }
        </div>
        <p class="keys muted small" aria-hidden="true">↑ ↓ to move · Enter to open · Esc to close</p>
      </app-dialog>
    }
  `,
  styles: `
    .box { display: flex; align-items: center; gap: 8px; padding: 0 10px; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface); }
    .box:focus-within { border-color: var(--main); }
    .box .input { flex: 1; border: 0; outline: none; box-shadow: none; padding: 10px 0; font-size: 16px; background: none; min-width: 0; }
    .box .input:focus, .box .input:focus-visible { border: 0; outline: none; box-shadow: none; }
    .results { margin-top: 10px; min-height: 120px; max-height: min(60vh, 520px); overflow-y: auto; }
    h3 { margin: 10px 4px 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
    h3:first-child { margin-top: 0; }
    .hit { display: grid; gap: 1px; width: 100%; padding: 7px 10px; font: inherit; text-align: left; color: inherit; background: none; border: 0;
      border-radius: var(--radius-md); cursor: pointer; }
    .hit.active { background: var(--hover); }
    .title { font-size: 14px; overflow-wrap: anywhere; }
    .hit.active .title { color: var(--main); }
    .sub { font-size: 12.5px; color: var(--muted); overflow-wrap: anywhere; }
    .keys { margin: 8px 0 0; }
    @media (max-width: 600px) { .keys { display: none; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPaletteComponent {
  protected readonly search = inject(SearchService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly query = signal('');
  protected readonly found = signal<SearchHit[]>([]);
  protected readonly loading = signal(false);
  protected readonly active = signal(0);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private seq = 0;

  /** Tools whose name matches, then the server's results. */
  protected readonly hits = computed<SearchHit[]>(() => {
    const words = fold(this.query()).split(/\s+/).filter(Boolean);
    const links = [OVERVIEW_LINK, ACTIVITY_LINK, ...TOOLS.map((t) => ({ label: t.title, route: t.route, description: t.description }))];
    const tools: SearchHit[] = words.length
      ? links
          .filter((l) => words.every((w) => fold(l.label).includes(w)))
          .slice(0, 4)
          .map((l) => ({ type: 'tool', id: l.route, title: l.label, sub: '', link: l.route }))
      : [];
    return [...tools, ...this.found()];
  });

  protected readonly groups = computed(() => {
    const out: { type: SearchHit['type']; label: string; hits: (SearchHit & { index: number })[] }[] = [];
    this.hits().forEach((h, index) => {
      let g = out.find((x) => x.type === h.type);
      if (!g) out.push((g = { type: h.type, label: TYPE_LABELS[h.type], hits: [] }));
      g.hits.push({ ...h, index });
    });
    return out;
  });

  protected onGlobalKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.search.open.set(true);
    }
  }

  protected type(value: string): void {
    this.query.set(value);
    this.active.set(0);
    clearTimeout(this.timer);
    if (!value.trim()) {
      this.found.set([]);
      return;
    }
    this.timer = setTimeout(() => void this.fetch(value), 200);
  }

  private async fetch(q: string): Promise<void> {
    const mine = ++this.seq;
    this.loading.set(true);
    try {
      const res = await this.api.get<{ items: SearchHit[] }>('/search', { q });
      if (mine === this.seq) this.found.set(res.items);
    } catch {
      if (mine === this.seq) this.found.set([]);
    } finally {
      if (mine === this.seq) this.loading.set(false);
    }
  }

  protected onKey(e: KeyboardEvent, dialog: DialogComponent): void {
    const n = this.hits().length;
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault();
      this.active.set((this.active() + 1) % n);
      this.scrollActive();
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault();
      this.active.set((this.active() - 1 + n) % n);
      this.scrollActive();
    } else if (e.key === 'Enter' && n) {
      e.preventDefault();
      this.go(this.hits()[this.active()], dialog);
    }
  }

  private scrollActive(): void {
    queueMicrotask(() => document.getElementById(`hit-${this.active()}`)?.scrollIntoView({ block: 'nearest' }));
  }

  protected go(h: SearchHit, dialog: DialogComponent): void {
    dialog.close();
    void this.router.navigateByUrl(h.link);
  }

  protected closed(): void {
    this.search.open.set(false);
    clearTimeout(this.timer);
    this.seq++;
    this.query.set('');
    this.found.set([]);
    this.active.set(0);
  }
}
