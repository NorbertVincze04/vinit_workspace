import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { apiError } from '../../../../../core/api/api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ButtonComponent, ConfirmDialogComponent, PanelComponent } from '../../../../../shared/ui';
import { LegacyClientsService } from '../../legacy-clients.service';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { countOf, t } from '../../../../../core/i18n/i18n';

/**
 * Shown (Overview, Salons) while this browser still has records of the old Clients tool that were
 * never moved. One click turns them into leads, or salons with their client and subscription.
 */
@Component({
  selector: 'app-legacy-clients-banner',
  standalone: true,
  imports: [TPipe, PanelComponent, ButtonComponent, ConfirmDialogComponent],
  template: `
    @if (visible()) {
      <app-panel heading="Old Clients list in this browser" [meta]="meta()">
        <p>
          {{ 'The old Clients tool saved its list in this browser. Move it to the server once: leads and demos become leads; beta, active and paused salons become a salon with its client and subscription. Add each client\'s business address afterwards (the old list had none).' | t }}
        </p>
        <div class="actions">
          <button appButton variant="primary" type="button" [disabled]="busy()" (click)="confirming.set(true)">
            {{ (busy() ? 'Moving…' : 'Move clients to the server') | t }}
          </button>
          <button appButton variant="ghost" type="button" [disabled]="busy()" (click)="hidden.set(true)">{{ 'Not now' | t }}</button>
        </div>
      </app-panel>
    }

    @if (confirming()) {
      <app-confirm-dialog
        heading="Move the old Clients list?"
        [message]="'This adds ' + meta() + ' on the server. Records moved before are skipped. The copy in this browser is kept.'"
        confirmLabel="Move clients"
        cancelLabel="Cancel"
        (confirmed)="move()"
        (closed)="confirming.set(false)"
      />
    }
  `,
  styles: `
    :host { display: block; }
    :host:not(:empty) { margin-bottom: 20px; }
    p { color: var(--muted); font-size: 14px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegacyClientsBannerComponent {
  private readonly legacy = inject(LegacyClientsService);
  private readonly toast = inject(ToastService);

  private readonly counts = signal(this.legacy.counts());
  protected readonly hidden = signal(false);
  protected readonly busy = signal(false);
  protected readonly confirming = signal(false);

  protected readonly visible = computed(() => {
    const c = this.counts();
    return !this.hidden() && !this.legacy.movedAt() && c.leads + c.salons > 0;
  });
  protected readonly meta = computed(() => {
    const { leads, salons } = this.counts();
    return [leads ? countOf(leads, 'lead', 'leads') : '', salons ? countOf(salons, 'salon', 'salons') : ''].filter(Boolean).join(' ' + t('and') + ' ');
  });

  protected async move(): Promise<void> {
    this.busy.set(true);
    try {
      const r = await this.legacy.move();
      const notes = r.notes.length ? ` ${r.notes.join('; ')}.` : '';
      const address = r.needsAddress ? ' ' + t('Add the business address of {clients} (Clients › Address missing).', { clients: countOf(r.needsAddress, 'client', 'clients') }) : '';
      this.toast.show(t('Moved: {leads}, {salons}.', { leads: countOf(r.leads, 'lead', 'leads'), salons: countOf(r.salons, 'salon', 'salons') }) + address + notes, 10_000);
    } catch (error) {
      this.toast.show(t('The move did not finish: {error} Nothing was changed.', { error: apiError(error).message }), 9000);
    } finally {
      this.busy.set(false);
    }
  }
}
