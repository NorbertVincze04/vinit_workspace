import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

export interface SectionLink {
  id: string;
  label: string;
}

/**
 * "On this page" jump links. A sticky side rail on wide screens, a sticky strip under the header on
 * narrow ones. Highlights the section currently in view.
 */
@Component({
  selector: 'app-section-nav',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav aria-label="On this page">
      <span class="title eyebrow">On this page</span>
      @for (item of items(); track item.id) {
        <a
          routerLink="/"
          [fragment]="item.id"
          [class.is-active]="active() === item.id"
          [attr.aria-current]="active() === item.id ? 'location' : null"
          (click)="active.set(item.id)"
        >
          {{ item.label }}
        </a>
      }
    </nav>
  `,
  styles: `
    :host {
      position: sticky;
      top: calc(var(--header-h) + 16px);
      align-self: start;
      z-index: 10;
    }
    nav { display: grid; gap: 2px; padding: 8px; background: var(--surface); border: 1px solid var(--line);
      border-radius: var(--radius-lg); }
    .title { padding: 6px 10px 8px; }
    a { padding: 8px 10px; font-size: 14px; font-weight: 600; color: var(--muted); text-decoration: none;
      border-left: 3px solid transparent; border-radius: var(--radius-sm); }
    a:hover { color: var(--ink); background: var(--main-soft); }
    a.is-active { color: var(--heading); background: var(--second-soft); border-left-color: var(--main); }

    /* Narrow screens: one scrolling strip pinned under the header. */
    @media (max-width: 960px) {
      :host { top: var(--header-h); }
      nav { display: flex; gap: 6px; padding: 8px var(--gutter); overflow-x: auto; border-width: 0 0 1px;
        border-radius: 0; scrollbar-width: none; }
      .title { display: none; }
      a { flex: none; white-space: nowrap; border-left: 0; border-radius: var(--radius-pill); }
      a.is-active { background: var(--second); color: var(--on-second); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionNavComponent {
  readonly items = input.required<readonly SectionLink[]>();

  protected readonly active = signal('');

  constructor() {
    const destroyRef = inject(DestroyRef);
    const host = inject<ElementRef<HTMLElement>>(ElementRef);

    // On the narrow strip, centre the active link inside the strip (scrolls only the strip, never the page).
    effect(() => {
      this.active();
      const nav = host.nativeElement.querySelector('nav');
      const link = nav?.querySelector<HTMLElement>('a.is-active');
      if (nav && link && nav.scrollWidth > nav.clientWidth) {
        nav.scrollTo({ left: link.offsetLeft - nav.clientWidth / 2 + link.offsetWidth / 2, behavior: 'smooth' });
      }
    });

    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      // A section counts as "current" while it crosses a band near the top of the viewport.
      const visible = new Set<string>();
      const observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) visible.add(e.target.id);
            else visible.delete(e.target.id);
          }
          const first = this.items().find((i) => visible.has(i.id));
          if (first) this.active.set(first.id);
        },
        { rootMargin: '-90px 0px -65% 0px' },
      );
      for (const item of this.items()) {
        const el = document.getElementById(item.id);
        if (el) observer.observe(el);
      }
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
