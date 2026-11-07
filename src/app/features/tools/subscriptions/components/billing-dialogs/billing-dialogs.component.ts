import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ToastService } from '../../../../../core/services/toast.service';
import { formatRon } from '../../../../../core/utils/format';
import { ConfirmDialogComponent, FieldDef, FormDialogComponent, FormValues, asNumber, asString } from '../../../../../shared/ui';
import { PlansStore } from '../../../salons/plans.store';
import { SalonsStore } from '../../../salons/salons.store';
import {
  MARK_PAID_FIELDS,
  changeBody,
  changeFields,
  changeTitle,
  markPaidBody,
  newSubscriptionBody,
  newSubscriptionFields,
  paymentFields,
} from '../../billing.fields';
import { ChangeKind, LIVE, Payment, Subscription } from '../../billing.model';
import { BillingStore } from '../../billing.store';

/** What the user asked to do; the dialogs below handle it. */
export type BillingRequest =
  /** Start a subscription (salonId given = for that salon, otherwise pick one). */
  | { kind: 'start'; salonId?: string; planId?: string }
  | { kind: 'change'; sub: Subscription; change: ChangeKind }
  | { kind: 'payment'; salonId?: string; subscriptionId?: string }
  | { kind: 'paid'; payment: Payment }
  | { kind: 'reopen'; payment: Payment }
  | { kind: 'waive'; payment: Payment }
  | { kind: 'delete-payment'; payment: Payment };

/**
 * Every billing dialog in one place, used by the Subscriptions page and the salon page:
 *   <app-billing-dialogs [request]="billing()" (done)="billing.set(null)" (changed)="reload()" />
 */
@Component({
  selector: 'app-billing-dialogs',
  standalone: true,
  imports: [FormDialogComponent, ConfirmDialogComponent],
  template: `
    @if (request(); as r) {
      @if (r.kind === 'start') {
        <app-form-dialog
          heading="New subscription"
          [subheading]="salonName(r.salonId)"
          [fields]="startFields()"
          saveLabel="Start subscription"
          (saved)="start($event)"
          (closed)="done.emit()"
        />
      } @else if (r.kind === 'change') {
        <app-form-dialog
          size="sm"
          [heading]="title(r.change)"
          [subheading]="r.sub.salonName + ' · ' + r.sub.planName"
          [fields]="changeFieldsFor(r.sub, r.change)"
          [saveLabel]="title(r.change)"
          (saved)="change(r.sub, r.change, $event)"
          (closed)="done.emit()"
        />
      } @else if (r.kind === 'payment') {
        <app-form-dialog
          heading="Add payment"
          [subheading]="salonName(r.salonId)"
          [fields]="paymentFieldsFor(r.salonId)"
          saveLabel="Add payment"
          (saved)="addPayment(r.salonId, r.subscriptionId, $event)"
          (closed)="done.emit()"
        />
      } @else if (r.kind === 'paid') {
        <app-form-dialog
          size="sm"
          heading="Mark paid"
          [subheading]="r.payment.salonName + ' · ' + money(r.payment.amount)"
          [fields]="paidFields"
          [initial]="{ invoiceNumber: r.payment.invoiceNumber }"
          saveLabel="Mark paid"
          (saved)="markPaid(r.payment, $event)"
          (closed)="done.emit()"
        />
      } @else if (r.kind === 'reopen') {
        <app-confirm-dialog
          heading="Mark as not paid?"
          [message]="'The payment of ' + money(r.payment.amount) + ' goes back to due' + (r.payment.transactionId ? ', and its income entry is removed from Finances.' : '.')"
          confirmLabel="Mark not paid"
          cancelLabel="Keep it paid"
          (confirmed)="reopen(r.payment)"
          (closed)="done.emit()"
        />
      } @else if (r.kind === 'waive') {
        <app-confirm-dialog
          heading="Waive this payment?"
          [message]="'The salon won’t have to pay ' + money(r.payment.amount) + ' (due ' + r.payment.dueOn + '). It stays in the list as waived.'"
          confirmLabel="Waive"
          cancelLabel="Keep it due"
          (confirmed)="waive(r.payment)"
          (closed)="done.emit()"
        />
      } @else if (r.kind === 'delete-payment') {
        <app-confirm-dialog
          heading="Delete payment?"
          [message]="'The ' + money(r.payment.amount) + ' payment due on ' + r.payment.dueOn + ' will be removed. Use “Waive” instead if the salon simply doesn’t have to pay it.'"
          cancelLabel="Keep it"
          (confirmed)="removePayment(r.payment)"
          (closed)="done.emit()"
        />
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BillingDialogsComponent {
  readonly request = input<BillingRequest | null>(null);
  readonly done = output<void>();
  /** After a successful change (the salon page reloads its overview). */
  readonly changed = output<void>();

  private readonly store = inject(BillingStore);
  private readonly plans = inject(PlansStore);
  private readonly salons = inject(SalonsStore);
  private readonly toast = inject(ToastService);

  protected readonly paidFields = MARK_PAID_FIELDS;
  protected readonly money = formatRon;
  protected readonly title = changeTitle;

  /** Salons without a running subscription. */
  private readonly unbilled = computed(() => {
    const live = new Set(this.store.subscriptions().filter((s) => LIVE.includes(s.status)).map((s) => s.salonId));
    return this.salons
      .salons()
      .filter((s) => !live.has(s.id) && s.status !== 'churned')
      .map((s) => ({ value: s.id, label: s.name }));
  });

  protected readonly startFields = computed<FieldDef[]>(() => {
    const r = this.request();
    if (r?.kind !== 'start') return [];
    return newSubscriptionFields(this.plans.plans(), this.plans.promotions(), r.salonId ? null : this.unbilled(), r.planId ?? '');
  });

  protected salonName(id?: string): string {
    return id ? (this.salons.get(id)?.name ?? '') : '';
  }

  protected changeFieldsFor(sub: Subscription, kind: ChangeKind): FieldDef[] {
    return changeFields(kind, sub, this.plans.plans());
  }

  protected paymentFieldsFor(salonId?: string): FieldDef[] {
    return paymentFields(salonId ? null : this.salons.salons().map((s) => ({ value: s.id, label: s.name })));
  }

  protected async start(v: FormValues): Promise<void> {
    const r = this.request();
    if (r?.kind !== 'start') return;
    const salonId = r.salonId ?? asString(v['salonId']);
    await this.run(() => this.store.start(salonId, newSubscriptionBody(v)), 'Subscription started');
  }

  protected async change(sub: Subscription, kind: ChangeKind, v: FormValues): Promise<void> {
    await this.run(() => this.store.change(sub, changeBody(kind, v)), `${changeTitle(kind)}: done`);
  }

  protected async addPayment(salonId: string | undefined, subscriptionId: string | undefined, v: FormValues): Promise<void> {
    const body = {
      salonId: salonId ?? asString(v['salonId']),
      ...(subscriptionId && asString(v['kind']) === 'subscription' ? { subscriptionId } : {}),
      kind: asString(v['kind']) || 'extra_work',
      amountBani: Math.round(asNumber(v['amount']) * 100),
      dueOn: asString(v['dueOn']),
      periodStart: asString(v['periodStart']) || null,
      periodEnd: asString(v['periodEnd']) || null,
      invoiceNumber: asString(v['invoiceNumber']),
      notes: asString(v['notes']),
    };
    await this.run(() => this.store.addPayment(body), 'Payment added');
  }

  protected async markPaid(p: Payment, v: FormValues): Promise<void> {
    const body = markPaidBody(v);
    await this.run(() => this.store.markPaid(p, body), body['createTransaction'] ? 'Paid · added to Finances' : 'Marked paid');
  }

  protected async reopen(p: Payment): Promise<void> {
    await this.run(() => this.store.reopen(p), 'Payment is due again');
  }

  protected async waive(p: Payment): Promise<void> {
    await this.run(() => this.store.updatePayment(p, { status: 'waived' }), 'Payment waived');
  }

  protected async removePayment(p: Payment): Promise<void> {
    await this.run(() => this.store.removePayment(p), 'Payment deleted');
  }

  private async run(action: () => Promise<unknown>, message: string): Promise<void> {
    try {
      await action();
      this.toast.show(message);
      this.changed.emit();
    } catch {
      /* the store showed the server's message */
    }
  }
}
