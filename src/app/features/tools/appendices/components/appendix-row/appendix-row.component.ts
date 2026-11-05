import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { formatDate } from '../../../../../core/utils/date';
import { ButtonComponent, IconComponent, LedgerRowComponent } from '../../../../../shared/ui';
import { Appendix, extensionOf, formatBytes, kindInfo } from '../../appendices.model';

/** One file in the appendices ledger: type tile, name, size, date added, download / delete. */
@Component({
  selector: 'app-appendix-row',
  standalone: true,
  imports: [LedgerRowComponent, ButtonComponent, IconComponent],
  template: `
    <app-ledger-row>
      <div class="file">
        <span class="ext" [attr.data-tone]="kind().tone" aria-hidden="true">{{ ext() }}</span>
        <div class="names">
          <span class="cell-title">{{ appendix().name }}</span>
          <span class="cell-sub">{{ kind().label }}<span class="phone"> · {{ size() }} · {{ added() }}</span></span>
        </div>
      </div>
      <div class="cell-num desk">{{ size() }}</div>
      <div class="desk muted small">{{ added() }}</div>
      <div class="cell-actions">
        <button appButton size="sm" type="button" [disabled]="busy()" [attr.aria-label]="'Download ' + appendix().name" (click)="download.emit()">
          <app-icon name="download" [size]="16" /> Download
        </button>
        <button appButton variant="ghost" size="sm" type="button" [attr.aria-label]="'Delete ' + appendix().name" (click)="remove.emit()">
          Delete
        </button>
      </div>
    </app-ledger-row>
  `,
  styles: `
    :host { display: block; }
    .file { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .names { min-width: 0; }
    .ext { display: inline-grid; place-items: center; flex: none; width: 42px; height: 46px;
      font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
      border-radius: 6px 12px 6px 6px; background: var(--tone-neutral-bg); color: var(--tone-neutral-fg);
      overflow: hidden; }
    .ext[data-tone='bad'] { background: var(--tone-bad-bg); color: var(--tone-bad-fg); }
    .ext[data-tone='warn'] { background: var(--tone-warn-bg); color: var(--tone-warn-fg); }
    .ext[data-tone='ok'] { background: var(--tone-ok-bg); color: var(--tone-ok-fg); }
    .ext[data-tone='info'] { background: var(--tone-info-bg); color: var(--tone-info-fg); }
    .ext[data-tone='teal'] { background: var(--tone-teal-bg); color: var(--tone-teal-fg); }
    .phone { display: none; }
    @media (max-width: 760px) {
      .desk { display: none; }
      .phone { display: inline; }
      .cell-actions { flex: 1 1 100%; justify-content: flex-start; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppendixRowComponent {
  readonly appendix = input.required<Appendix>();
  /** True while this file is being read for download. */
  readonly busy = input(false, { transform: booleanAttribute });

  readonly download = output<void>();
  readonly remove = output<void>();

  protected readonly kind = computed(() => kindInfo(this.appendix().kind));
  protected readonly ext = computed(() => extensionOf(this.appendix().name).slice(0, 4) || 'file');
  protected readonly size = computed(() => formatBytes(this.appendix().size));
  protected readonly added = computed(() =>
    formatDate(new Date(this.appendix().createdAt).toLocaleDateString('sv-SE')),
  );
}
