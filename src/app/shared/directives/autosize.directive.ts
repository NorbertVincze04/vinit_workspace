import { AfterViewInit, Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * Grows a textarea to fit its content. Pass the bound value so it also resizes on outside changes.
 *   <textarea rows="1" [value]="text" [appAutosize]="text"></textarea>
 */
@Directive({
  selector: 'textarea[appAutosize]',
  standalone: true,
  host: {
    '(input)': 'resize()',
    '(window:resize)': 'resize()',
  },
})
export class AutosizeDirective implements AfterViewInit {
  readonly appAutosize = input<string>('');

  private readonly el = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;

  constructor() {
    effect(() => {
      this.appAutosize();
      queueMicrotask(() => this.resize());
    });
  }

  ngAfterViewInit(): void {
    this.resize();
    document.fonts?.ready.then(() => this.resize());
  }

  resize(): void {
    this.el.style.height = 'auto';
    this.el.style.height = `${this.el.scrollHeight + 2}px`;
  }
}
