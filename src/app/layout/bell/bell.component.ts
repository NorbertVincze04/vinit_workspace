import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppNotification, NotificationsService } from '../../core/services/notifications.service';
import { formatDateTime } from '../../core/utils/date';
import { ButtonComponent, DialogComponent, IconComponent } from '../../shared/ui';

/** Bell with the unread count; opens the person's notifications. */
@Component({
  selector: 'app-bell',
  standalone: true,
  imports: [ButtonComponent, IconComponent, DialogComponent],
  template: `
    <button
      type="button"
      class="bell"
      [attr.aria-label]="service.unread() ? service.unread() + ' unread notifications' : 'Notifications'"
      (click)="openPanel()"
    >
      <app-icon name="bell" [size]="18" />
      @if (service.unread()) {
        <span class="badge" aria-hidden="true">{{ service.unread() > 99 ? '99+' : service.unread() }}</span>
      }
    </button>

    @if (open()) {
      <app-dialog #dlg heading="Notifications" [subheading]="service.unread() ? service.unread() + ' unread' : 'All read'" (closed)="open.set(false)">
        @if (service.items().length) {
          <ul>
            @for (n of service.items(); track n.id) {
              <li [class.unread]="!n.readAt" [attr.data-severity]="n.severity">
                <button type="button" class="item" (click)="go(n, dlg)">
                  <span class="title">{{ n.title }}</span>
                  @if (n.body) {
                    <span class="body">{{ n.body }}</span>
                  }
                  <span class="when">{{ when(n.createdAt) }}</span>
                </button>
                <button type="button" class="x" [attr.aria-label]="'Dismiss: ' + n.title" (click)="service.dismiss(n)">×</button>
              </li>
            }
          </ul>
        } @else if (service.loading()) {
          <p class="muted">Loading…</p>
        } @else {
          <p class="muted">Nothing to report. You'll see late payments, trials ending, follow-ups, deadlines and more here.</p>
        }
        <div dialogFooter>
          @if (service.unread()) {
            <button appButton type="button" (click)="service.readAll()">Mark all read</button>
          }
          <button appButton variant="primary" type="button" (click)="dlg.close()">Close</button>
        </div>
      </app-dialog>
    }
  `,
  styles: `
    :host { display: inline-flex; }
    .bell { position: relative; display: inline-grid; place-items: center; width: 36px; height: 36px; color: var(--ink); background: none;
      border: 0; border-radius: var(--radius-md); cursor: pointer; }
    .bell:hover { background: var(--hover); }
    .badge { position: absolute; top: 2px; right: 0; min-width: 17px; height: 17px; padding: 0 4px; font-size: 11px; font-weight: 700; line-height: 17px;
      text-align: center; color: #fff; background: var(--red); border-radius: 9px; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    li { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; border-left: 3px solid transparent; border-radius: var(--radius-md); }
    li.unread { background: var(--hover); }
    li[data-severity='bad'] { border-left-color: var(--red); }
    li[data-severity='warn'] { border-left-color: var(--tone-warn-fg); }
    .item { display: grid; gap: 2px; padding: 8px 10px; font: inherit; text-align: left; color: inherit; background: none; border: 0; cursor: pointer; min-width: 0; }
    .item:hover .title { color: var(--main); text-decoration: underline; }
    .title { font-size: 14px; overflow-wrap: anywhere; }
    li.unread .title { font-weight: 600; }
    .body { font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
    .when { font-size: 12px; color: var(--muted); }
    .x { width: 30px; height: 30px; margin: 4px; font-size: 18px; color: var(--muted); background: none; border: 0; border-radius: var(--radius-md); cursor: pointer; }
    .x:hover { background: var(--surface); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BellComponent {
  protected readonly service = inject(NotificationsService);
  private readonly router = inject(Router);
  protected readonly open = signal(false);
  protected readonly when = formatDateTime;

  protected openPanel(): void {
    this.open.set(true);
    void this.service.load();
  }

  protected go(n: AppNotification, dialog: DialogComponent): void {
    void this.service.read(n);
    dialog.close();
    if (n.link) void this.router.navigateByUrl(n.link);
  }
}
