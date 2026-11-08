import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { apiError } from '../../../core/api/api.service';
import { uid } from '../../../core/utils/id';
import { parseAmount } from '../../../core/utils/text';
import { ButtonComponent } from '../button/button.component';
import { CheckboxComponent } from '../checkbox/checkbox.component';
import { DialogComponent } from '../dialog/dialog.component';
import { SelectOption } from '../form-field/field.types';
import { SegmentedComponent } from '../segmented/segmented.component';
import { FieldDef, FormValue, FormValues, isEmail } from './form.model';

/**
 * Create / edit dialog generated from field definitions. Show it with @if; it emits (saved) with the
 * validated values and closes itself.
 *
 * Pass [save] (an async function) to keep the dialog open until the server accepts the values: if it
 * throws, the dialog stays open with the error shown, so nothing typed is lost.
 *
 *   @if (form(); as f) {
 *     <app-form-dialog heading="New client" [fields]="clientFields" [initial]="f.values"
 *       saveLabel="Save client" (saved)="save($event)" (closed)="form.set(null)" />
 *   }
 */
@Component({
  selector: 'app-form-dialog',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, CheckboxComponent, SegmentedComponent],
  templateUrl: './form-dialog.component.html',
  styleUrl: './form-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormDialogComponent implements OnInit {
  readonly heading = input.required<string>();
  readonly subheading = input('');
  readonly fields = input.required<readonly FieldDef[]>();
  readonly initial = input<FormValues>({});
  readonly saveLabel = input('Save');
  /** Grid columns for the fields (fields can span several). */
  readonly columns = input<2 | 4>(2);
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  /** Optional save: the dialog closes only when it resolves, and shows the error when it throws. */
  readonly save = input<((values: FormValues) => Promise<unknown>) | null>(null);

  readonly saved = output<FormValues>();
  readonly closed = output<void>();

  protected readonly formId = uid('form-');
  protected readonly values = signal<FormValues>({});
  protected readonly error = signal('');
  /** Something was typed or picked since the form opened. */
  protected readonly dirty = signal(false);
  /** [save] is running. */
  protected readonly saving = signal(false);
  protected readonly visibleFields = computed(() =>
    this.fields().filter((f) => !f.show || f.show(this.values())),
  );

  private readonly dialog = viewChild.required(DialogComponent);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  ngOnInit(): void {
    const start: FormValues = {};
    for (const f of this.fields()) {
      const existing = this.initial()[f.key];
      if (existing !== undefined) start[f.key] = existing;
      else if (f.default !== undefined) start[f.key] = typeof f.default === 'function' ? f.default() : f.default;
      else start[f.key] = f.type === 'check' ? false : f.type === 'multi' ? [] : '';
    }
    this.values.set(start);
  }

  // ---- template helpers ----

  protected fieldId(f: FieldDef): string {
    return `${this.formId}-${f.key}`;
  }

  protected req(f: FieldDef): boolean {
    return typeof f.required === 'function' ? f.required(this.values()) : !!f.required;
  }

  protected spanOf(f: FieldDef): string {
    return f.span === 'full' ? '1 / -1' : `span ${f.span ?? 1}`;
  }

  protected optionsOf(f: FieldDef): readonly SelectOption[] {
    return typeof f.options === 'function' ? f.options(this.values()) : (f.options ?? []);
  }

  protected text(f: FieldDef): string {
    const v = this.values()[f.key];
    return v === undefined || typeof v === 'boolean' || Array.isArray(v) ? '' : String(v);
  }

  protected bool(f: FieldDef): boolean {
    return this.values()[f.key] === true;
  }

  protected hasOption(f: FieldDef, option: string): boolean {
    const v = this.values()[f.key];
    return Array.isArray(v) && v.includes(option);
  }

  protected onInput(f: FieldDef, event: Event): void {
    this.set(f, (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value);
  }

  protected toggleOption(f: FieldDef, option: string, checked: boolean): void {
    const current = this.values()[f.key];
    const list = Array.isArray(current) ? current.filter((x) => x !== option) : [];
    this.set(f, checked ? [...list, option] : list);
  }

  protected set(f: FieldDef, value: FormValue): void {
    let next: FormValues = { ...this.values(), [f.key]: value };
    if (f.onChange) next = { ...next, ...(f.onChange(next) as FormValues) };
    this.values.set(next);
    this.dirty.set(true);
  }

  // ---- submit ----

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    const out: FormValues = {};
    const values = this.values();

    for (const f of this.fields()) {
      if (f.show && !f.show(values)) {
        out[f.key] = '';
        continue;
      }
      const result = this.parseField(f, values[f.key]);
      if (typeof result === 'object' && result !== null && 'error' in result) {
        this.fail(result.error, f);
        return;
      }
      out[f.key] = result as FormValue;
    }

    this.error.set('');
    const save = this.save();
    if (save) {
      this.saving.set(true);
      try {
        await save(out);
      } catch (error) {
        this.failFromServer(error);
        return;
      } finally {
        this.saving.set(false);
      }
    }
    this.saved.emit(out);
    this.dialog().close();
  }

  /** Shows the server's message; a field error names (and focuses) that field. */
  private failFromServer(error: unknown): void {
    const body = apiError(error);
    const fieldErrors = body.fields ?? {};
    const field = this.visibleFields().find((f) => fieldErrors[f.key]);
    if (field) this.fail(`${field.label}: ${fieldErrors[field.key]}`, field);
    else this.fail(body.message);
  }

  private parseField(f: FieldDef, raw: FormValue | undefined): FormValue | { error: string } {
    switch (f.type) {
      case 'number': {
        let n = parseAmount(raw);
        if (n === null) {
          if (this.req(f)) return { error: `${f.label} is required.` };
          n = 0;
        }
        if (Number.isNaN(n)) return { error: `${f.label} must be a number, like 1250 or 49,99.` };
        if (n < 0 && !f.allowNegative) return { error: `${f.label} can't be negative.` };
        if (f.min !== undefined && n < f.min) return { error: `${f.label} must be at least ${f.min}.` };
        return f.integer ? Math.round(n) : Math.round(n * 100) / 100;
      }
      case 'check':
        return raw === true;
      case 'multi':
        return Array.isArray(raw) ? [...raw] : [];
      case 'select':
      case 'switch': {
        const options = this.optionsOf(f);
        const value = typeof raw === 'string' ? raw : '';
        const valid = options.some((o) => o.value === value) ? value : (options[0]?.value ?? '');
        if (this.req(f) && !valid) return { error: `${f.label} is required.` };
        return valid;
      }
      default: {
        const value = String(raw ?? '').trim();
        if (this.req(f) && !value) return { error: `${f.label} is required.` };
        if (!value) return value;
        const max = f.maxLength ?? (f.type === 'textarea' ? 4000 : 300);
        if (value.length > max) return { error: `${f.label} can have at most ${max} characters.` };
        if (f.type === 'email' && !isEmail(value)) return { error: `${f.label} must be a valid e-mail address.` };
        const problem = f.validate?.(value, this.values());
        if (problem) return { error: problem };
        return value;
      }
    }
  }

  private fail(message: string, f?: FieldDef): void {
    this.error.set(message);
    if (f) this.host.nativeElement.querySelector<HTMLElement>(`#${this.fieldId(f)}`)?.focus();
  }
}
