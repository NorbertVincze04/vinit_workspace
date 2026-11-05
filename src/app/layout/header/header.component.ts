import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NAV_LINKS } from '../../core/data/tools.data';
import { ThemeService } from '../../core/services/theme.service';
import { ButtonComponent, IconComponent, LogoComponent } from '../../shared/ui';

/** Sticky top bar: logo, main navigation (built from the tools registry) and theme toggle. */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ButtonComponent, IconComponent, LogoComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  host: { '(document:keydown.escape)': 'closeMenu()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly links = NAV_LINKS;
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
