import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { apiError } from '../../../../../core/api/api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { formatDate } from '../../../../../core/utils/date';
import { downloadBlob } from '../../../../../core/utils/file';
import { ButtonComponent } from '../../../../../shared/ui';
import { MAX_FILE_BYTES, formatBytes } from '../../../files/files.model';
import { FilesStore } from '../../../files/files.store';

export interface Attachment {
  id: string;
  name: string;
  sizeBytes: number;
  createdAt: string;
  contractId?: string | null;
}

/**
 * Files of a salon or a contract: download, remove (with "Yes / No"), upload more. They are also
 * listed in the Files tool.
 */
@Component({
  selector: 'app-attachments',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <ul>
      @for (f of files(); track f.id) {
        <li>
          <button class="name" type="button" (click)="download(f)">{{ f.name }}</button>
          <span class="muted">{{ size(f.sizeBytes) }} · {{ date(f.createdAt) }}</span>
          @if (confirming() === f.id) {
            <span class="confirm">Remove? <button type="button" class="yes" (click)="remove(f)">Yes</button><button type="button" (click)="confirming.set(null)">No</button></span>
          } @else {
            <button class="x" type="button" [attr.aria-label]="'Remove ' + f.name" (click)="confirming.set(f.id)">×</button>
          }
        </li>
      } @empty {
        <li class="muted">{{ empty() }}</li>
      }
    </ul>
    <input #picker type="file" hidden multiple (change)="upload($event)" />
    <button appButton size="sm" type="button" [disabled]="busy()" (click)="picker.click()">{{ busy() ? 'Uploading…' : 'Attach files' }}</button>
  `,
  styles: `
    :host { display: grid; gap: 10px; justify-items: start; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; width: 100%; font-size: 14px; }
    li { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
    .name { font: inherit; font-weight: 600; color: var(--main); background: none; border: 0; padding: 0; cursor: pointer; text-align: left; overflow-wrap: anywhere; }
    .name:hover { text-decoration: underline; }
    .muted { font-size: 12.5px; }
    .x { margin-left: auto; width: 28px; height: 28px; font-size: 18px; color: var(--muted); background: none; border: 0; border-radius: var(--radius-md); cursor: pointer; opacity: 0.5; }
    .x:hover, .x:focus-visible { opacity: 1; background: var(--hover); }
    .confirm { margin-left: auto; display: inline-flex; gap: 6px; align-items: center; font-size: 13px; }
    .confirm button { font: inherit; padding: 2px 10px; border: 1px solid var(--line-strong); border-radius: var(--radius-md); background: var(--surface); color: var(--ink); cursor: pointer; }
    .confirm .yes { color: var(--red); border-color: var(--red); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttachmentsComponent {
  readonly files = input.required<readonly Attachment[]>();
  readonly salonId = input<string | undefined>(undefined);
  readonly contractId = input<string | undefined>(undefined);
  readonly empty = input('No files yet.');
  readonly changed = output<void>();

  private readonly store = inject(FilesStore);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);
  protected readonly confirming = signal<string | null>(null);
  protected readonly size = formatBytes;
  protected readonly date = (iso: string) => formatDate(iso.slice(0, 10));

  protected async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    input.value = '';
    if (!picked.length) return;
    this.busy.set(true);
    let added = 0;
    for (const file of picked) {
      if (file.size > MAX_FILE_BYTES) {
        this.toast.show(`${file.name} is larger than 50 MB.`, 6000);
        continue;
      }
      try {
        await this.store.send(file, undefined, { salonId: this.salonId(), contractId: this.contractId() });
        added++;
      } catch (error) {
        this.toast.show(`${file.name}: ${apiError(error).message}`, 6000);
      }
    }
    this.busy.set(false);
    if (added) {
      this.toast.show(`Attached ${added} ${added === 1 ? 'file' : 'files'}`);
      this.changed.emit();
    }
  }

  protected async download(f: Attachment): Promise<void> {
    const blob = await this.store.blob(f);
    if (blob) downloadBlob(blob, f.name);
    else this.toast.show('This file is no longer on the server.', 5000);
  }

  protected async remove(f: Attachment): Promise<void> {
    this.confirming.set(null);
    try {
      await this.store.delete(f.id);
      this.toast.show(`Removed ${f.name}`);
      this.changed.emit();
    } catch (error) {
      this.toast.show(`Not removed: ${apiError(error).message}`, 6000);
    }
  }
}
