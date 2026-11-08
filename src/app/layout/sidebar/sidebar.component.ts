import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ACTIVITY_LINK, OVERVIEW_LINK, TOOL_GROUPS, toNavLink } from '../../core/data/tools.data';
import { AuthService } from '../../core/auth/auth.service';
import { Lang, lang, setLang } from '../../core/i18n/i18n';
import { TPipe } from '../../core/i18n/t.pipe';
import { StorageService } from '../../core/services/storage.service';
import { ThemeService } from '../../core/services/theme.service';
import { IconComponent, LogoComponent } from '../../shared/ui';
import { BellComponent } from '../bell/bell.component';
import { SearchService } from '../search/search-palette.component';

/**
 * Workspace navigation: logo, overview, tools (from the registry), theme switch, save status and sign-out.
 * Emits (navigate) after a link is followed so the mobile drawer can close.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent, LogoComponent, BellComponent, TPipe],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly storage = inject(StorageService);
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  /** Server writes, plus the per-device settings kept in this browser. */
  protected readonly save = computed(() => {
    const status = this.api.status();
    if (status === 'saving') return { text: 'Saving…', failed: false, detail: '' };
    if (status === 'failed') return { text: 'Not saved — check the server', failed: true, detail: this.api.lastError() ?? '' };
    if (this.storage.writeFailed()) return { text: 'Settings not saved in this browser', failed: true, detail: '' };
    return { text: 'All changes saved', failed: false, detail: '' };
  });
  protected readonly overview = OVERVIEW_LINK;
  protected readonly activity = ACTIVITY_LINK;
  private readonly search = inject(SearchService);

  protected readonly currentLang = lang();
  protected readonly languages: readonly { value: Lang; short: string; name: string }[] = [
    { value: 'ro', short: 'RO', name: 'Română' },
    { value: 'en', short: 'EN', name: 'English' },
  ];

  /** Reloads the app in the other language, once pending saves have reached the server. */
  protected async switchLang(next: Lang): Promise<void> {
    if (next === this.currentLang) return;
    for (let i = 0; i < 50 && this.api.pending() > 0; i++) await new Promise((r) => setTimeout(r, 100));
    setLang(next);
  }

  protected openSearch(): void {
    this.navigate.emit();
    this.search.open.set(true);
  }
  protected readonly groups = TOOL_GROUPS.map((g) => ({ id: g.id, title: g.title, links: g.tools.map(toNavLink) }));

  readonly navigate = output<void>();
}
