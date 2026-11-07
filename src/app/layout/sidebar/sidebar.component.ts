import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { OVERVIEW_LINK, TOOL_LINKS } from '../../core/data/tools.data';
import { AuthService } from '../../core/auth/auth.service';
import { StorageService } from '../../core/services/storage.service';
import { ThemeService } from '../../core/services/theme.service';
import { IconComponent, LogoComponent } from '../../shared/ui';

/**
 * Workspace navigation: logo, overview, tools (from the registry), theme switch and save status.
 * Emits (navigate) after a link is followed so the mobile drawer can close.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent, LogoComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly storage = inject(StorageService);
  protected readonly auth = inject(AuthService);
  protected readonly overview = OVERVIEW_LINK;
  protected readonly tools = TOOL_LINKS;

  readonly navigate = output<void>();
}
