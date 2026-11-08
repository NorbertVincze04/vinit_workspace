import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LocalDataService } from '../../../../core/services/local-data.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ButtonComponent, ConfirmDialogComponent, PanelComponent } from '../../../../shared/ui';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { t } from '../../../../core/i18n/i18n';

/** "1 post", "3 posts"; '' for zero. */
const count = (n: number, one: string, many = one + 's'): string => (n ? `${n} ${n === 1 ? one : many}` : '');

/**
 * Shown on the Overview while this browser still has data from before the server existed.
 * Moving it is a one-time step; the browser copy is kept as a fallback.
 */
@Component({
  selector: 'app-local-data-banner',
  standalone: true,
  imports: [TPipe, PanelComponent, ButtonComponent, ConfirmDialogComponent],
  template: `
    @if (visible()) {
      <app-panel heading="Data saved in this browser" [meta]="parts()">
        <p>
          {{ 'Before the server existed, this browser kept your workspace data. Move it to the server once, so it is available on every device. The old Clients list is moved separately (below).' | t }}
        </p>
        <div class="actions">
          <button appButton variant="primary" type="button" [disabled]="busy()" (click)="confirming.set(true)">
            {{ (busy() ? 'Moving…' : 'Move to the server') | t }}
          </button>
          <button appButton variant="ghost" type="button" [disabled]="busy()" (click)="hidden.set(true)">{{ 'Not now' | t }}</button>
        </div>
      </app-panel>
    }

    @if (confirming()) {
      <app-confirm-dialog
        heading="Move this browser's data?"
        message="Tasks, Finances, Marketing and Roadmap on the server will be replaced with this browser's copy, and its files will be uploaded. Use the browser that has your latest data. The copy in this browser is kept."
        confirmLabel="Move data"
        cancelLabel="Cancel"
        (confirmed)="move()"
        (closed)="confirming.set(false)"
      />
    }
  `,
  styles: `
    :host { display: block; }
    :host:not(:empty) { margin-bottom: 24px; }
    p { color: var(--muted); font-size: 14px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocalDataBannerComponent {
  private readonly local = inject(LocalDataService);
  private readonly toast = inject(ToastService);

  private readonly summary = signal(this.local.summary());
  protected readonly hidden = signal(false);
  protected readonly busy = signal(false);
  protected readonly confirming = signal(false);

  protected readonly visible = computed(
    () => !this.hidden() && !this.local.movedAt() && this.summary().total > 0,
  );

  protected readonly parts = computed(() => {
    const s = this.summary();
    return [
      count(s.tasks, 'task'),
      count(s.finances, 'finance entry', 'finance entries'),
      count(s.posts, 'post'),
      count(s.roadmapSteps, 'roadmap step'),
      count(s.files, 'file'),
    ]
      .filter(Boolean)
      .join(' · ');
  });

  protected async move(): Promise<void> {
    this.busy.set(true);
    try {
      const { files } = await this.local.moveToServer();
      const skipped = files.skipped.length ? ' ' + t('{n} file(s) skipped: {list}', { n: files.skipped.length, list: files.skipped.join('; ') }) : '';
      this.toast.show(t('Your data is on the server now.') + skipped, skipped ? 9000 : 4000);
    } catch (error) {
      this.toast.show(t('The move did not finish: {error} Nothing in this browser was deleted.', { error: (error as Error).message }), 9000);
    } finally {
      this.busy.set(false);
    }
  }
}
