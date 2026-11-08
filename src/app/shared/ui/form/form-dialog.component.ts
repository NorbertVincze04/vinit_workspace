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
import { t } from '../../../core/i18n/i18n';
import { TPipe } from '../../../core/i18n/t.pipe';
import { uid } from '../../../core/utils/id';
import { parseAmount } from '../../../core/utils/text';
import { ButtonComponent } from '../button/button.component';
import { CheckboxComponent } from '../checkbox/checkbox.component';
import { DialogComponent } from '../dialog/dialog.component';
import { SelectOption } from '../form-field/field.types';
import { SegmentedComponent } from '../segmented/segmented.component';
import { FieldDef, FormValue, FormValues, isEmail, isPhone, isUrl } from './form.model';

type Parsed = FormValue | { error: string };
const failed = (r: Parsed): r is { error: string } => typeof r === 'object' && r !== null && 'error' in r;

/**
 * Create / edit dialog generated from field definitions. Show it with @if; it emits (saved) with the
 * validated values and closes itself.
 *
 * Every field is checked as you go (its message shows once you leave it, or when you press Save):
 * required, length, numbers, e-mail, phone, links, dates and each field's own `validate` rule.
 * Save is refused while anything is wrong and focuses the first problem.
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
  imports: [DialogComponent, ButtonComponent, CheckboxComponent, SegmentedComponent, TPipe],
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
  /** Form-level message (server errors, "check the fields"). */
  protected readonly error = signal('');
  /** Something was typed or picked since the form opened. */
  protected readonly dirty = signal(false);
  /** [save] is running. */
  protected readonly saving = signal(false);
  /** Fields the user has left (their errors show from then on). */
  private readonly touched = signal<ReadonlySet<string>>(new Set());
  /** Save was pressed: every error shows. */
  private readonly submitted = signal(false);
  /** Messages the server gave for fields, until the field changes. */
  private readonly serverErrors = signal<Readonly<Record<string, string>>>({});

  protected readonly visibleFields = computed(() =>
    this.fields().filter((f) => !f.show || f.show(this.values())),
  );

  /** Current problem of every visible field. */
  protected readonly errors = computed<Readonly<Record<string, string>>>(() => {
    const out: Record<string, string> = {};
    const values = this.values();
    for (const f of this.visibleFields()) {
      const r = this.parseField(f, values[f.key]);
      if (failed(r)) out[f.key] = r.error;
    }
    return { ...out, ...this.serverErrors() };
  });

  protected readonly errorCount = computed(() => Object.keys(this.errors()).length);

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

  /** The field's message, once it was left or Save was pressed. */
  protected shownError(f: FieldDef): string {
    const message = this.errors()[f.key];
    return message && (this.submitted() || this.touched().has(f.key) || this.serverErrors()[f.key]) ? message : '';
  }

  protected errorId(f: FieldDef): string {
    return `${this.fieldId(f)}-error`;
  }

  /** aria-describedby: the error (when shown) and the hint. */
  protected describedBy(f: FieldDef): string | null {
    const ids = [this.shownError(f) ? this.errorId(f) : '', f.hint ? `${this.fieldId(f)}-hint` : ''].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  }

  protected touch(f: FieldDef): void {
    if (this.touched().has(f.key)) return;
    this.touched.update((s) => new Set(s).add(f.key));
  }

  protected onInput(f: FieldDef, event: Event): void {
    this.set(f, (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value);
  }

  protected toggleOption(f: FieldDef, option: string, checked: boolean): void {
    const current = this.values()[f.key];
    const list = Array.isArray(current) ? current.filter((x) => x !== option) : [];
    this.set(f, checked ? [...list, option] : list);
    this.touch(f);
  }

  protected set(f: FieldDef, value: FormValue): void {
    let next: FormValues = { ...this.values(), [f.key]: value };
    if (f.onChange) next = { ...next, ...(f.onChange(next) as FormValues) };
    this.values.set(next);
    this.dirty.set(true);
    if (this.serverErrors()[f.key]) {
      const { [f.key]: _gone, ...rest } = this.serverErrors();
      this.serverErrors.set(rest);
    }
    if (this.error() && this.submitted() && !this.errorCount()) this.error.set('');
  }

  // ---- submit ----

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    this.submitted.set(true);
    this.serverErrors.set({});

    const out: FormValues = {};
    const values = this.values();
    let first: FieldDef | null = null;
    for (const f of this.fields()) {
      if (f.show && !f.show(values)) {
        out[f.key] = '';
        continue;
      }
      const result = this.parseField(f, values[f.key]);
      if (failed(result)) first ??= f;
      else out[f.key] = result;
    }
    if (first) {
      const n = this.errorCount();
      this.error.set(n === 1 ? t('Check the highlighted field.') : t('Check the {n} highlighted fields.', { n }));
      this.focus(first);
      return;
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

  private parseField(f: FieldDef, raw: FormValue | undefined): Parsed {
    const label = t(f.label);
    switch (f.type) {
      case 'number': {
        let n = parseAmount(raw);
        if (n === null) {
          if (this.req(f)) return { error: t('{label} is required.', { label }) };
          n = 0;
        }
        if (Number.isNaN(n)) return { error: t('{label} must be a number, like 1250 or 49,99.', { label }) };
        if (n < 0 && !f.allowNegative) return { error: t('{label} can’t be negative.', { label }) };
        if (f.integer && !Number.isInteger(n)) return { error: t('{label} must be a whole number.', { label }) };
        if (f.min !== undefined && n < f.min) return { error: t('{label} must be at least {min}.', { label, min: f.min }) };
        if (f.max !== undefined && n > f.max) return { error: t('{label} must be at most {max}.', { label, max: f.max }) };
        return f.integer ? Math.round(n) : Math.round(n * 100) / 100;
      }
      case 'check':
        if (this.req(f) && raw !== true) return { error: t('Tick “{label}” to continue.', { label: t(f.checkLabel || f.label) }) };
        return raw === true;
      case 'multi': {
        const list = Array.isArray(raw) ? [...raw] : [];
        if (this.req(f) && !list.length) return { error: t('Pick at least one option for {label}.', { label }) };
        return list;
      }
      case 'select':
      case 'switch': {
        const options = this.optionsOf(f);
        const value = typeof raw === 'string' ? raw : '';
        const valid = options.some((o) => o.value === value) ? value : (options[0]?.value ?? '');
        if (this.req(f) && !valid) return { error: t('Choose {label}.', { label }) };
        return valid;
      }
      default: {
        const value = String(raw ?? '').trim();
        if (this.req(f) && !value) return { error: t('{label} is required.', { label }) };
        if (!value) return value;
        const max = f.maxLength ?? (f.type === 'textarea' ? 4000 : 300);
        if (value.length > max) return { error: t('{label} can have at most {max} characters.', { label, max }) };
        if (f.minLength && value.length < f.minLength) return { error: t('{label} needs at least {min} characters.', { label, min: f.minLength }) };
        if (f.type === 'email' && !isEmail(value)) return { error: t('Enter a valid e-mail address, like name@salon.ro.') };
        if (f.type === 'tel' && !isPhone(value)) return { error: t('Enter a valid phone number, like 0740 123 456 or +40 740 123 456.') };
        if (f.type === 'url' && !isUrl(value)) return { error: t('Enter a full link, starting with https://') };
        if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: t('Enter a valid date.') };
        if (f.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return { error: t('Enter a time like 14:30.') };
        const problem = f.validate?.(value, this.values());
        if (problem) return { error: t(problem) };
        return value;
      }
    }
  }

  /** Shows the server's message; a field error names (and focuses) that field. */
  private failFromServer(error: unknown): void {
    const body = apiError(error);
    const fieldErrors = body.fields ?? {};
    const known = this.visibleFields().filter((f) => fieldErrors[f.key]);
    if (known.length) {
      this.serverErrors.set(Object.fromEntries(known.map((f) => [f.key, t(fieldErrors[f.key])])));
      this.error.set(t(body.message));
      this.focus(known[0]);
    } else {
      this.error.set(t(body.message));
    }
  }

  private focus(f: FieldDef): void {
    queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>(`#${this.fieldId(f)}`)?.focus());
  }
}
