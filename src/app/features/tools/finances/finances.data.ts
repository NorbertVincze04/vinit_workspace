import { Frequency } from '../../../core/utils/date';
import { ChartSeries } from '../../../shared/components';
import { ChipOption, SelectOption } from '../../../shared/ui';

/** Reference lists for the Finances tool. */

export type TxType = 'income' | 'expense' | 'invest';
export type Currency = 'RON' | 'EUR' | 'USD';
export type Scope = 'personal' | 'business';
export type AccountKind = 'bank' | 'savings' | 'cash' | 'ewallet' | 'card' | 'loan';
export type FinanceCollection = 'transactions' | 'recurring' | 'holdings' | 'accounts' | 'budgets';

export const TX_TYPES: readonly SelectOption[] = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'invest', label: 'Invest' },
];

export const CURRENCIES: readonly SelectOption[] = [
  { value: 'RON', label: 'RON' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
];

export const SCOPES: readonly SelectOption[] = [
  { value: 'business', label: 'Business (VINIT)' },
  { value: 'personal', label: 'Personal' },
];

export const CATEGORIES: Readonly<Record<TxType, readonly string[]>> = {
  income: ['VINIT revenue', 'Salary', 'Freelance & projects', 'Grants & funding', 'Scholarship', 'Interest & dividends', 'Gifts received', 'Refunds', 'Other income'],
  expense: ['Business costs', 'Subscriptions & software', 'Advertising', 'Accounting & legal', 'Rent & housing', 'Utilities', 'Groceries', 'Eating out', 'Transport', 'Phone & internet', 'Health', 'Education', 'Clothing', 'Entertainment', 'Travel', 'Gifts', 'Taxes & fees', 'Debt payments', 'Other'],
  invest: ['ETF & stocks', 'Crypto', 'Government bonds (Tezaur, Fidelis)', 'Bank deposit', 'Pension (Pilon III)', 'Other investment'],
};

export const FREQUENCIES: readonly SelectOption[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Every 3 months' },
  { value: 'yearly', label: 'Yearly' },
];

/** How many times per month a frequency occurs. */
export const PER_MONTH: Readonly<Record<Frequency, number>> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

export const ACCOUNT_KINDS: readonly SelectOption[] = [
  { value: 'bank', label: 'Bank account' },
  { value: 'savings', label: 'Savings account' },
  { value: 'cash', label: 'Cash' },
  { value: 'ewallet', label: 'E-wallet' },
  { value: 'card', label: 'Credit card' },
  { value: 'loan', label: 'Loan' },
];

/** Account kinds whose balance is money owed. */
export const LIABILITY_KINDS: readonly AccountKind[] = ['card', 'loan'];

export const DEFAULT_RATES = { eur: 5.09, usd: 4.38 } as const;

export const FINANCE_TABS: readonly ChipOption[] = [
  { value: 'transactions', label: 'Transactions' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'holdings', label: 'Investments' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'budgets', label: 'Budgets' },
];

/** Chart series, fixed order and colours (validated palette: --chart-1..3). */
export const CASH_FLOW_SERIES: readonly ChartSeries[] = [
  { key: 'income', label: 'Income', color: 'var(--chart-1)' },
  { key: 'expense', label: 'Expenses', color: 'var(--chart-2)' },
  { key: 'invest', label: 'Invested', color: 'var(--chart-3)' },
];

export const toOptions = (list: readonly string[]): SelectOption[] => list.map((v) => ({ value: v, label: v }));

export function labelOf(list: readonly SelectOption[], value: string): string {
  return list.find((o) => o.value === value)?.label ?? value;
}
