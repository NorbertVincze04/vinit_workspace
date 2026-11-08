import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ButtonComponent, ButtonVariant } from '../button/button.component';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * Dropdown menu for secondary actions. Project <button appMenuItem> elements as the items.
 * Closes on item click, outside click and Escape; arrow keys move between items.
 *
 *   <app-menu ariaLabel="More actions">
 *     <button appMenuItem type="button" (click)="export()">Export backup</button>
 *     <button appMenuItem tone="danger" type="button" (click)="reset()">Reset</button>
 *   </app-menu>
 */
@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [TPipe, ButtonComponent, IconComponent],
  template: `
    <button
      appButton
      type="button"
      [variant]="variant()"
      [iconOnly]="!label()"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="(ariaLabel() | t) || null"
      (click)="toggle()"
    >
      <app-icon [name]="icon()" [size]="18" />
      @if (label()) {
        {{ label() | t }}
      }
    </button>
    <div class="panel" role="menu" [attr.data-align]="align()" [hidden]="!open()" (click)="onPanelClick($event)" (keydown)="onKey($event)">
      <ng-content />
    </div>
  `,
  styles: `
    :host { position: relative; display: inline-flex; }
    .panel { position: absolute; top: calc(100% + 6px); right: 0; z-index: 70; display: grid; min-width: 210px;
      padding: 5px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg); }
    .panel[data-align='start'] { right: auto; left: 0; }
    .panel[hidden] { display: none; }
  `,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close(true)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuComponent {
  /** Visible trigger text; when empty the trigger is an icon button and needs ariaLabel. */
  readonly label = input('');
  readonly ariaLabel = input('');
  readonly icon = input<IconName>('more');
  readonly variant = input<ButtonVariant>('secondary');
  /** Which edge of the trigger the panel lines up with. */
  readonly align = input<'start' | 'end'>('end');

  protected readonly open = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.open.set(true);
    queueMicrotask(() => this.items()[0]?.focus());
  }

  close(returnFocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) this.host.querySelector<HTMLElement>('button[aria-haspopup]')?.focus();
  }

  protected onPanelClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('[role="menuitem"]')) this.close();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.contains(event.target as Node)) this.close();
  }

  protected onKey(event: KeyboardEvent): void {
    const items = this.items();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      event.preventDefault();
      items[(to + items.length) % items.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(items.length - 1);
    else if (event.key === 'Tab') this.close();
  }

  private items(): HTMLElement[] {
    return Array.from(this.host.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
  }
}
