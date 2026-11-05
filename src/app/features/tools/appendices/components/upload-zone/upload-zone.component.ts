import { ChangeDetectionStrategy, Component, ElementRef, booleanAttribute, input, output, signal, viewChild } from '@angular/core';
import { ButtonComponent, IconComponent } from '../../../../../shared/ui';

/**
 * Drop area + file picker for one or more files. Touch screens get a plain "Choose files" button.
 *   <app-upload-zone [busy]="store.uploading() > 0" hint="Up to 50 MB each" (files)="upload($event)" />
 */
@Component({
  selector: 'app-upload-zone',
  standalone: true,
  imports: [ButtonComponent, IconComponent],
  template: `
    <div
      class="zone"
      [class.is-over]="over()"
      [attr.aria-busy]="busy()"
      (dragenter)="onDrag($event, true)"
      (dragover)="onDrag($event, true)"
      (dragleave)="onLeave($event)"
      (drop)="onDrop($event)"
    >
      <span class="badge" aria-hidden="true"><app-icon name="upload" [size]="22" /></span>
      <div class="text">
        <p class="title">
          @if (busy()) {
            Saving files…
          } @else {
            <span class="drop">Drop files here or choose them from your device</span>
            <span class="tap">Add files from your device</span>
          }
        </p>
        @if (hint()) {
          <p class="hint">{{ hint() }}</p>
        }
      </div>
      <button appButton variant="primary" type="button" class="pick" [disabled]="busy()" (click)="open()">
        <app-icon name="plus" [size]="16" /> Choose files
      </button>
      <input #picker type="file" multiple hidden [attr.accept]="accept() || null" (change)="onPick($event)" />
    </div>
  `,
  styles: `
    :host { display: block; margin-bottom: 18px; }
    .zone { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 18px; padding: 22px 24px;
      background: var(--surface); border: 1.5px dashed var(--line); border-radius: var(--radius-lg);
      transition: border-color 0.15s ease, background-color 0.15s ease; }
    .zone.is-over { border-color: var(--main); background: color-mix(in srgb, var(--main-soft) 55%, var(--surface)); }
    .zone[aria-busy='true'] { opacity: 0.8; }
    .badge { display: inline-grid; place-items: center; width: 46px; height: 46px; flex: none; color: var(--main);
      background: var(--main-soft); border-radius: var(--radius-md); }
    .text { flex: 1 1 240px; min-width: 0; display: grid; gap: 2px; }
    .title { font-weight: 600; }
    .hint { font-size: 13px; color: var(--muted); }
    .tap { display: none; }
    /* Touch screens can't drag files in: say "add", and give the button the full width. */
    @media (hover: none) {
      .drop { display: none; }
      .tap { display: inline; }
    }
    @media (max-width: 560px) {
      .zone { padding: 18px 16px; }
      .pick { flex: 1 1 100%; justify-content: center; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadZoneComponent {
  readonly hint = input('');
  /** Optional accept attribute for the picker (e.g. ".pdf,.pptx"). Empty accepts every file. */
  readonly accept = input('');
  readonly busy = input(false, { transform: booleanAttribute });

  readonly files = output<File[]>();

  protected readonly over = signal(false);
  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');

  open(): void {
    if (!this.busy()) this.picker().nativeElement.click();
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.emit(input.files);
    input.value = '';
  }

  protected onDrag(event: DragEvent, over: boolean): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = this.busy() ? 'none' : 'copy';
    this.over.set(over && !this.busy());
  }

  protected onLeave(event: DragEvent): void {
    const zone = event.currentTarget as HTMLElement;
    if (!zone.contains(event.relatedTarget as Node | null)) this.over.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    if (!this.busy()) this.emit(event.dataTransfer?.files);
  }

  private emit(list: FileList | null | undefined): void {
    const files = Array.from(list ?? []);
    if (files.length) this.files.emit(files);
  }
}
