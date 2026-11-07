import { ChangeDetectionStrategy, Component, ElementRef, booleanAttribute, input, output, signal, viewChild } from '@angular/core';
import { IconComponent } from '../../../../../shared/ui';

/**
 * Drop area + file picker for one or more files. Touch screens get a plain "Choose files" button.
 *   <app-upload-zone [busy]="store.uploading() > 0" hint="Up to 50 MB each" (files)="upload($event)" />
 */
@Component({
  selector: 'app-upload-zone',
  standalone: true,
  imports: [IconComponent],
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
      <app-icon class="icon" name="upload" [size]="20" />
      <p class="title">
        @if (busy()) {
          Saving files…
        } @else {
          <span class="drop">Drag files here, or </span>
          <button type="button" class="pick" (click)="open()">choose from your device</button>
        }
      </p>
      @if (hint()) {
        <p class="hint">{{ hint() }}</p>
      }
      <input #picker type="file" multiple hidden [attr.accept]="accept() || null" (change)="onPick($event)" />
    </div>
  `,
  styles: `
    :host { display: block; margin-bottom: 16px; }
    .zone { display: grid; justify-items: center; gap: 4px; padding: 20px 16px; text-align: center;
      background: var(--surface); border: 1.5px dashed var(--line-strong); border-radius: var(--radius-lg);
      transition: border-color 0.15s ease, background-color 0.15s ease; }
    .zone.is-over { border-color: var(--main); background: var(--main-soft); }
    .zone[aria-busy='true'] { opacity: 0.8; }
    .icon { color: var(--muted); margin-bottom: 2px; }
    .title { font-weight: 500; }
    .pick { padding: 0; font: inherit; font-weight: 600; color: var(--main); background: none; border: 0; cursor: pointer; }
    .pick:hover { text-decoration: underline; }
    .hint { font-size: 12.5px; color: var(--muted); }
    /* Touch screens can't drag files in. */
    @media (hover: none) {
      .drop { display: none; }
      .pick::first-letter { text-transform: uppercase; }
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
