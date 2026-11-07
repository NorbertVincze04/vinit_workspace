import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { ButtonComponent, IconComponent, LogoComponent, ToastComponent } from './shared/ui';

/**
 * App shell: sidebar navigation (a drawer on small screens), the routed page and the toast area.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, SidebarComponent, ButtonComponent, IconComponent, LogoComponent, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  host: { '(document:keydown.escape)': 'closeNav()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  /** Mobile drawer state; ignored on wide screens where the sidebar is always shown. */
  protected readonly navOpen = signal(false);

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.navOpen.set(false));
  }

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }

  protected skipToContent(event: Event, main: HTMLElement): void {
    event.preventDefault();
    main.focus();
  }
}
