import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { formatRon } from '../../../core/utils/format';
import {
  ButtonComponent,
  ChipGroupComponent,
  ChipOption,
  ConfirmDialogComponent,
  EmptyStateComponent,
  FieldDef,
  FormDialogComponent,
  FormValues,
  IconComponent,
  LedgerComponent,
  LedgerRowComponent,
  PageHeaderComponent,
  StatusPillComponent,
  asString,
  toFormValues,
} from '../../../shared/ui';
import { RequestDialogComponent } from './components/request-dialog/request-dialog.component';
import { FeatureRequest, REQUEST_STATUSES, requestStatus } from './features.model';
import { FeaturesStore } from './features.store';

/** Feature requests tool: what salons and leads ask for, weighed by the revenue behind it. */
@Component({
  selector: 'app-features-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    ButtonComponent,
    IconComponent,
    ChipGroupComponent,
    LedgerComponent,
    LedgerRowComponent,
    StatusPillComponent,
    EmptyStateComponent,
    FormDialogComponent,
    ConfirmDialogComponent,
    RequestDialogComponent,
  ],
  template: `
    <app-page-header title="Feature requests" description="What salons and leads ask for, ranked by the MRR of the paying salons behind it, then votes.">
      <div pageActions>
        <button appButton variant="primary" type="button" (click)="openForm(null)"><app-icon name="plus" [size]="16" /> New request</button>
      </div>
    </app-page-header>

    @if (store.items().length) {
      <div class="toolbar">
        <app-chip-group label="Filter requests" [options]="chips()" [(value)]="filter" />
      </div>
    }

    @if (!store.loaded()) {
      <app-empty-state heading="Loading…" text="Reading feature requests from the VINIT server." />
    } @else if (!store.items().length) {
      <app-empty-state heading="No feature requests yet" text="Add what salons ask for, then record each salon or lead that wants it. Change-request tickets can be turned into requests too.">
        <button appButton variant="primary" type="button" (click)="openForm(null)">New request</button>
      </app-empty-state>
    } @else if (!visible().length) {
      <app-empty-state heading="Nothing here" text="No request matches this filter." />
    } @else {
      <app-ledger [headers]="['Request', 'Asked by', 'MRR behind it', 'Status']" [numeric]="[1, 2]" columns="minmax(0, 2.4fr) 90px 120px 120px">
        @for (r of visible(); track r.id) {
          <app-ledger-row clickable (activate)="openId.set(r.id)">
            <div>
              <span class="cell-title">{{ r.title }}</span>
              <span class="cell-sub">{{ r.roadmapStepId ? 'Roadmap ' + r.roadmapStepId + ' · ' + r.roadmapStepText : 'Not on the roadmap' }}</span>
            </div>
            <span class="cell-num">{{ r.votes }}</span>
            <span class="cell-num">{{ money(r.mrrBani) }}</span>
            <div><app-status-pill [tone]="status(r.status).tone">{{ status(r.status).label }}</app-status-pill></div>
          </app-ledger-row>
        }
      </app-ledger>
    }

    @if (openId(); as id) {
      <app-request-dialog [requestId]="id" (edit)="openForm($event)" (remove)="deleting.set($event)" (closed)="openId.set(null)" />
    }
    @if (form(); as f) {
      <app-form-dialog [heading]="f.item ? 'Edit request' : 'New request'" [fields]="fields" [initial]="f.values" saveLabel="Save request" (saved)="save($event)" (closed)="form.set(null)" />
    }
    @if (deleting(); as r) {
      <app-confirm-dialog heading="Delete request?" [message]="'“' + r.title + '” and its votes will be removed. Linked tickets stay.'" cancelLabel="Keep it" (confirmed)="confirmDelete(r)" (closed)="deleting.set(null)" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturesPageComponent {
  protected readonly store = inject(FeaturesStore);
  private readonly toast = inject(ToastService);

  protected readonly filter = signal('open');
  protected readonly openId = signal<string | null>(null);
  protected readonly form = signal<{ item: FeatureRequest | null; values: FormValues } | null>(null);
  protected readonly deleting = signal<FeatureRequest | null>(null);
  private readonly dialog = viewChild(RequestDialogComponent);

  protected readonly status = requestStatus;
  protected readonly money = (bani: number) => (bani ? formatRon(bani / 100) : '—');

  protected readonly chips = computed<ChipOption[]>(() => {
    const all = this.store.items();
    return [
      { value: 'open', label: 'Open', count: this.store.open().length },
      ...REQUEST_STATUSES.map((s) => ({ value: s.value, label: s.label, count: all.filter((r) => r.status === s.value).length })),
    ];
  });

  protected readonly visible = computed(() => {
    const f = this.filter();
    return f === 'open' ? this.store.open() : this.store.items().filter((r) => r.status === f);
  });

  protected get fields(): FieldDef[] {
    return [
      { key: 'title', label: 'What is asked', type: 'text', required: true, maxLength: 300, span: 'full', placeholder: 'e.g. Card deposits for no-shows' },
      { key: 'description', label: 'Details', type: 'textarea', span: 'full' },
      {
        key: 'roadmapStepId',
        label: 'Roadmap step',
        type: 'select',
        span: 'full',
        options: [{ value: '', label: 'None' }, ...this.store.steps().map((s) => ({ value: s.id, label: `${s.id} · ${s.text}` }))],
      },
    ];
  }

  protected openForm(item: FeatureRequest | null): void {
    this.form.set({ item, values: item ? { ...toFormValues(item), roadmapStepId: item.roadmapStepId ?? '' } : {} });
  }

  protected async save(v: FormValues): Promise<void> {
    const body = { title: asString(v['title']), description: asString(v['description']), roadmapStepId: asString(v['roadmapStepId']) || null };
    const editing = this.form()?.item;
    try {
      if (editing) {
        await this.store.update(editing.id, body);
        this.dialog()?.refresh();
      } else {
        const r = await this.store.create(body);
        this.openId.set(r.id);
      }
      this.toast.show('Request saved');
    } catch {
      /* toast shown */
    }
  }

  protected async confirmDelete(r: FeatureRequest): Promise<void> {
    try {
      await this.store.remove(r.id);
      this.openId.set(null);
      this.toast.show('Request deleted');
    } catch {
      /* toast shown */
    }
  }
}
