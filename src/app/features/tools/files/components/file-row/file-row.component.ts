import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { formatDate } from '../../../../../core/utils/date';
import { ButtonComponent, IconComponent, LedgerRowComponent } from '../../../../../shared/ui';
import { StoredFile, extensionOf, formatBytes, kindInfo } from '../../files.model';
import { TPipe } from '../../../../../core/i18n/t.pipe';

/** One file in the files ledger: type tile, name, size, date added, download / delete. */
@Component({
  selector: 'app-file-row',
  standalone: true,
  imports: [TPipe, LedgerRowComponent, ButtonComponent, IconComponent],
  template: `
    <app-ledger-row>
      <div class="file">
        <span class="ext" [attr.data-tone]="kind().tone" aria-hidden="true">{{ ext() }}</span>
        <div class="names">
          <span class="cell-title">{{ file().name }}</span>
          <span class="cell-sub">{{ kind().label }}<span class="phone"> · {{ size() }} · {{ added() }}</span></span>
        </div>
      </div>
      <div class="cell-num desk">{{ size() }}</div>
      <div class="desk muted small">{{ added() }}</div>
      <div class="cell-actions">
        <button appButton size="sm" type="button" [disabled]="busy()" [attr.aria-label]="'Download ' + file().name" (click)="download.emit()">
          <app-icon name="download" [size]="16" /> {{ 'Download' | t }}
        </button>
        <button appButton variant="ghost" size="sm" type="button" [attr.aria-label]="'Delete ' + file().name" (click)="remove.emit()">
          {{ 'Delete' | t }}
        </button>
      </div>
    </app-ledger-row>
  `,
  styles: `
    :host { display: block; }
    .file { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .names { min-width: 0; }
    .ext { display: inline-grid; place-items: center; flex: none; width: 36px; height: 36px;
      font-size: 10px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase;
      border-radius: var(--radius-md); background: var(--tone-neutral-bg); color: var(--tone-neutral-fg);
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
export class FileRowComponent {
  readonly file = input.required<StoredFile>();
  /** True while this file is being read for download. */
  readonly busy = input(false, { transform: booleanAttribute });

  readonly download = output<void>();
  readonly remove = output<void>();

  protected readonly kind = computed(() => kindInfo(this.file().kind));
  protected readonly ext = computed(() => extensionOf(this.file().name).slice(0, 4) || 'file');
  protected readonly size = computed(() => formatBytes(this.file().size));
  protected readonly added = computed(() =>
    formatDate(new Date(this.file().createdAt).toLocaleDateString('sv-SE')),
  );
}
