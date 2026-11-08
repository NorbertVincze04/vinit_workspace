import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal, viewChild } from '@angular/core';
import { ToastService } from '../../../../../core/services/toast.service';
import { ButtonComponent, DialogComponent } from '../../../../../shared/ui';
import { STEP_CATEGORIES, StepCategory, TemplateItem } from '../../onboarding.model';
import { OnboardingStore } from '../../onboarding.store';
import { TPipe } from '../../../../../core/i18n/t.pipe';
import { TcPipe } from '../../../../../core/i18n/tc.pipe';

/** Edit the checklist every new onboarding starts from (running onboardings keep their own). */
@Component({
  selector: 'app-template-editor',
  standalone: true,
  imports: [TcPipe, TPipe, DialogComponent, ButtonComponent],
  template: `
    <app-dialog #dialog size="lg" heading="Onboarding checklist" subheading="New onboardings start with these steps. Running ones keep theirs." (closed)="closed.emit()">
      @if (items(); as list) {
        <ol class="rows">
          @for (item of list; track $index; let i = $index) {
            <li>
              <input class="input" maxlength="300" [attr.aria-label]="'Step {n}' | t: { n: i + 1 }" [value]="item.title | tc" (input)="set(i, 'title', $event)" />
              <select class="input" [attr.aria-label]="'Category of step ' + (i + 1)" (change)="set(i, 'category', $event)">
                @for (c of categories; track c.value) {
                  <option [value]="c.value" [selected]="c.value === item.category">{{ c.label | t }}</option>
                }
              </select>
              <span class="moves">
                <button appButton variant="ghost" size="sm" type="button" [disabled]="i === 0" [attr.aria-label]="'Move step ' + (i + 1) + ' up'" (click)="move(i, -1)">↑</button>
                <button appButton variant="ghost" size="sm" type="button" [disabled]="i === list.length - 1" [attr.aria-label]="'Move step ' + (i + 1) + ' down'" (click)="move(i, 1)">↓</button>
                <button appButton variant="ghost" size="sm" type="button" [attr.aria-label]="'Remove step ' + (i + 1)" (click)="remove(i)">×</button>
              </span>
            </li>
          }
        </ol>
        <button appButton size="sm" type="button" (click)="add()">{{ 'Add a step' | t }}</button>
      } @else {
        <p class="muted">{{ 'Loading…' | t }}</p>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <div dialogFooter>
        <button appButton type="button" (click)="dialog.close()">{{ 'Cancel' | t }}</button>
        <button appButton variant="primary" type="button" [disabled]="!items()" (click)="save()">{{ 'Save checklist' | t }}</button>
      </div>
    </app-dialog>
  `,
  styles: `
    .rows { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 8px; }
    li { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 220px) auto; gap: 8px; align-items: center; }
    .moves { display: inline-flex; }
    .error { color: var(--red); font-size: 13.5px; margin-top: 8px; }
    @media (max-width: 560px) { li { grid-template-columns: 1fr auto; } li select { grid-column: 1; } .moves { grid-row: 1 / span 2; grid-column: 2; flex-direction: column; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateEditorComponent implements OnInit {
  readonly closed = output<void>();

  private readonly store = inject(OnboardingStore);
  private readonly toast = inject(ToastService);
  private readonly dialog = viewChild.required(DialogComponent);

  protected readonly items = signal<TemplateItem[] | null>(null);
  protected readonly error = signal('');
  protected readonly categories = STEP_CATEGORIES;

  async ngOnInit(): Promise<void> {
    try {
      this.items.set(await this.store.template());
    } catch {
      this.error.set('Could not load the checklist.');
    }
  }

  protected set(i: number, key: 'title' | 'category', event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.items.update((list) => list!.map((x, j) => (j === i ? { ...x, [key]: key === 'category' ? (value as StepCategory) : value } : x)));
  }

  protected move(i: number, by: number): void {
    this.items.update((list) => {
      const next = [...list!];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });
  }

  protected remove(i: number): void {
    this.items.update((list) => list!.filter((_, j) => j !== i));
  }

  protected add(): void {
    this.items.update((list) => [...list!, { title: '', description: '', category: 'setup' }]);
  }

  protected async save(): Promise<void> {
    const list = (this.items() ?? []).map((x) => ({ ...x, title: x.title.trim() }));
    if (!list.length) return this.error.set('Keep at least one step.');
    if (list.some((x) => !x.title)) return this.error.set('Every step needs a title (or remove the empty ones).');
    try {
      await this.store.saveTemplate(list);
      this.toast.show('Checklist saved');
      this.dialog().close();
    } catch {
      /* toast shown */
    }
  }
}
