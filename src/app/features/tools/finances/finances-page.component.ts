import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { formatDate, monthName, shiftMonth } from '../../../core/utils/date';
import { downloadCsv } from '../../../core/utils/file';
import { BackupMenuComponent, BarChartComponent } from '../../../shared/components';
import {
  ButtonComponent,
  ConfirmDialogComponent,
  FormDialogComponent,
  FormValues,
  IconComponent,
  MenuItemComponent,
  MonthSwitcherComponent,
  PageHeaderComponent,
  PanelComponent,
  TabsComponent,
  asNumber,
  toFormValues,
} from '../../../shared/ui';
import { AccountsPanelComponent } from './components/accounts-panel/accounts-panel.component';
import { BudgetsPanelComponent } from './components/budgets-panel/budgets-panel.component';
import { CategorySpendingComponent } from './components/category-spending/category-spending.component';
import { FinanceOverviewComponent } from './components/finance-overview/finance-overview.component';
import { HoldingsPanelComponent } from './components/holdings-panel/holdings-panel.component';
import { RecurringPanelComponent } from './components/recurring-panel/recurring-panel.component';
import { TransactionsPanelComponent } from './components/transactions-panel/transactions-panel.component';
import { CASH_FLOW_SERIES, FinanceCollection } from './finances.data';
import { FORM_META, RATE_FIELDS, financeFields } from './finances.fields';
import { Recurring } from './finances.model';
import { FinancesStore } from './finances.store';

interface OpenForm {
  collection: FinanceCollection;
  id: string | null;
  values: FormValues;
}

interface PendingDelete {
  collection: FinanceCollection;
  id: string;
  name: string;
}

/** Finances tool: VINIT and personal money — transactions, recurring payments, investments, accounts, budgets. */
@Component({
  selector: 'app-finances-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    PanelComponent,
    ButtonComponent,
    IconComponent,
    MenuItemComponent,
    TabsComponent,
    MonthSwitcherComponent,
    FormDialogComponent,
    ConfirmDialogComponent,
    BackupMenuComponent,
    BarChartComponent,
    FinanceOverviewComponent,
    CategorySpendingComponent,
    TransactionsPanelComponent,
    RecurringPanelComponent,
    HoldingsPanelComponent,
    AccountsPanelComponent,
    BudgetsPanelComponent,
  ],
  templateUrl: './finances-page.component.html',
  styleUrl: './finances-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancesPageComponent {
  protected readonly store = inject(FinancesStore);
  private readonly toast = inject(ToastService);

  protected readonly series = CASH_FLOW_SERIES;
  protected readonly rateFields = RATE_FIELDS;
  protected readonly fields = financeFields(
    () => this.store.accountOptions(),
    () => this.store.holdingOptions(),
  );

  protected readonly form = signal<OpenForm | null>(null);
  protected readonly deleting = signal<PendingDelete | null>(null);
  protected readonly ratesOpen = signal(false);

  protected readonly monthLabel = computed(() => monthName(this.store.month()));
  protected readonly previousLabel = computed(() => monthName(shiftMonth(this.store.month(), -1), true));
  protected readonly formHeading = computed(() => {
    const f = this.form();
    return f ? `${f.id ? 'Edit' : 'New'} ${FORM_META[f.collection].noun}` : '';
  });

  protected setTab(value: string): void {
    this.store.tab.set(value as FinanceCollection);
  }

  protected meta(collection: FinanceCollection): { noun: string; sub: string } {
    return FORM_META[collection];
  }

  protected openForm(collection: FinanceCollection, record?: object & { id: string }): void {
    this.form.set({ collection, id: record?.id ?? null, values: toFormValues(record) });
  }

  protected save(values: FormValues): void {
    const f = this.form();
    if (!f) return;
    this.store.save(f.collection, f.id, values);
    const name = values['description'] || values['name'] || values['category'] || FORM_META[f.collection].noun;
    this.toast.show(`${f.id ? 'Saved' : 'Added'} ${name}`);
  }

  protected askDelete(collection: FinanceCollection, record: { id: string; description?: string; name?: string; category?: string }): void {
    const name = record.description || record.name || record.category || `This ${FORM_META[collection].noun}`;
    this.deleting.set({ collection, id: record.id, name });
  }

  protected deleteMessage(d: PendingDelete): string {
    let extra = '';
    if (d.collection === 'accounts') extra = ' Transactions that used it stay, without an account.';
    if (d.collection === 'holdings') extra = ' Linked Invest entries stay in the transactions.';
    return `“${d.name}” will be removed for good.${extra}`;
  }

  protected confirmDelete(d: PendingDelete): void {
    this.store.remove(d.collection, d.id);
    this.toast.show(`Deleted ${d.name}`);
  }

  protected logRecurring(r: Recurring): void {
    const next = this.store.logRecurring(r);
    this.toast.show(`Logged ${r.name || 'payment'}. Next due ${formatDate(next)}`);
  }

  protected saveRates(values: FormValues): void {
    this.store.setRates({ eur: asNumber(values['eur']), usd: asNumber(values['usd']) });
    this.toast.show('Rates saved');
  }

  protected exportCsv(): void {
    const period = this.store.txFilters().period === 'month' ? this.store.month() : 'all';
    downloadCsv(this.store.csvRows(), `vinit-finances-${period}.csv`);
  }
}
