import { Entity } from '../../../core/models';
import { Frequency } from '../../../core/utils/date';
import { StatusTone } from '../../../shared/ui';
import { AccountKind, Currency, Scope, TxType } from './finances.data';

export interface Transaction extends Entity {
  type: TxType;
  description: string;
  amount: number;
  currency: Currency;
  /** "YYYY-MM-DD" */
  date: string;
  category: string;
  scope: Scope;
  accountId: string;
  /** For Invest entries: the holding this contribution belongs to. */
  holdingId: string;
  reference: string;
  notes: string;
  recurringId?: string;
}

export interface Recurring extends Entity {
  type: TxType;
  name: string;
  amount: number;
  currency: Currency;
  frequency: Frequency;
  nextDate: string;
  category: string;
  scope: Scope;
  accountId: string;
  active: boolean;
  notes: string;
}

export interface Holding extends Entity {
  name: string;
  kind: string;
  platform: string;
  /** Invested before tracking started. */
  opening: number;
  currentValue: number;
  currency: Currency;
  valueDate: string;
  notes: string;
}

export interface Account extends Entity {
  name: string;
  kind: AccountKind;
  currency: Currency;
  /** For cards and loans: the amount owed. */
  balance: number;
  asOf: string;
  notes: string;
}

export interface Budget extends Entity {
  category: string;
  /** Monthly limit in RON. */
  limit: number;
}

export interface Rates {
  eur: number;
  usd: number;
}

export interface Totals {
  income: number;
  expense: number;
  invest: number;
}

export interface TxFilters {
  /** TxType or 'all'. */
  type: string;
  /** Scope or 'all'. */
  scope: string;
  period: 'month' | 'all';
  q: string;
}

// ---- Row views (pre-formatted for the panels) ----

export interface TxRow {
  tx: Transaction;
  day: string;
  monthText: string;
  sub: string;
  typeLabel: string;
  typeTone: StatusTone;
  business: boolean;
  amountText: string;
  amountClass: string;
  ronText: string;
}

export interface RecurringRow {
  item: Recurring;
  sub: string;
  dueText: string;
  dueLabel: string;
  dueTone: StatusTone;
  amountText: string;
  amountClass: string;
  perMonthText: string;
  canLog: boolean;
}

export interface HoldingRow {
  item: Holding;
  sub: string;
  investedText: string;
  valueText: string;
  ronText: string;
  gainText: string;
  gainPctText: string;
  gainNegative: boolean;
}

export interface AccountRow {
  item: Account;
  sub: string;
  kindLabel: string;
  kindTone: StatusTone;
  balanceText: string;
  ronText: string;
  liability: boolean;
}

export interface BudgetRow {
  item: Budget;
  spentText: string;
  pct: number;
  leftText: string;
  over: boolean;
  limitText: string;
}

export interface CategorySpend {
  name: string;
  spent: number;
  budget: number | null;
  over: boolean;
}

export interface FinanceBackup {
  transactions: Transaction[];
  recurring: Recurring[];
  holdings: Holding[];
  accounts: Account[];
  budgets: Budget[];
  rates: Rates;
}
