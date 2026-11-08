import { todayISO } from '../../../core/utils/date';
import { FieldDef, FormValues, SelectOption, asString } from '../../../shared/ui';
import {
  ACCOUNT_KINDS,
  CATEGORIES,
  CURRENCIES,
  FREQUENCIES,
  FinanceCollection,
  SCOPES,
  TX_TYPES,
  TxType,
  toOptions,
} from './finances.data';

/** Dialog texts per collection. */
export const FORM_META: Readonly<Record<FinanceCollection, { noun: string; sub: string }>> = {
  transactions: { noun: 'entry', sub: 'Money in, money out, or money put to work.' },
  recurring: { noun: 'recurring payment', sub: 'Bills, subscriptions, salaries: anything that repeats.' },
  holdings: { noun: 'investment', sub: 'Track what was put in and what it is worth now.' },
  accounts: { noun: 'account', sub: 'Bank accounts, cash and debts. Update the balance whenever you check it.' },
  budgets: { noun: 'budget', sub: 'A monthly spending limit for one category.' },
};

const categoriesFor = (v: FormValues): SelectOption[] =>
  toOptions(CATEGORIES[(asString(v['type']) as TxType) || 'expense'] ?? CATEGORIES.expense);

/**
 * Field definitions per collection. Account and investment pickers read live options.
 * @param accounts  current account options (with "None")
 * @param holdings  current investment options (with "None")
 */
export function financeFields(
  accounts: () => readonly SelectOption[],
  holdings: () => readonly SelectOption[],
): Readonly<Record<FinanceCollection, readonly FieldDef[]>> {
  return {
    transactions: [
      { key: 'type', label: 'Type', type: 'switch', options: TX_TYPES, default: 'expense', span: 'full' },
      { key: 'description', label: 'Description', type: 'text', required: true, span: 'full', placeholder: 'What was it for?' },
      { key: 'amount', label: 'Amount', type: 'number', required: true, min: 0.01 },
      { key: 'currency', label: 'Currency', type: 'select', options: CURRENCIES, default: 'RON' },
      { key: 'date', label: 'Date', type: 'date', required: true, default: todayISO },
      { key: 'category', label: 'Category', type: 'select', options: categoriesFor },
      { key: 'scope', label: 'Business or personal', type: 'select', options: SCOPES, default: 'business' },
      { key: 'accountId', label: 'Account', type: 'select', options: () => accounts() },
      {
        key: 'holdingId',
        label: 'Investment',
        type: 'select',
        options: () => holdings(),
        show: (v) => v['type'] === 'invest',
        hint: 'Adds this amount to the investment’s contributions.',
      },
      { key: 'reference', label: 'Reference', type: 'text', placeholder: 'Invoice or receipt no.' },
      { key: 'notes', label: 'Notes', type: 'textarea', span: 'full', placeholder: 'Optional details, e.g. who paid and why' },
    ],
    recurring: [
      { key: 'type', label: 'Type', type: 'switch', options: TX_TYPES, default: 'expense', span: 'full' },
      { key: 'name', label: 'Name', type: 'text', required: true, span: 'full', placeholder: 'Vercel, accounting, salary' },
      { key: 'amount', label: 'Amount', type: 'number', required: true, min: 0.01 },
      { key: 'currency', label: 'Currency', type: 'select', options: CURRENCIES, default: 'RON' },
      { key: 'frequency', label: 'Repeats', type: 'select', options: FREQUENCIES, default: 'monthly' },
      { key: 'nextDate', label: 'Next due', type: 'date', required: true, default: todayISO },
      { key: 'category', label: 'Category', type: 'select', options: categoriesFor },
      { key: 'scope', label: 'Business or personal', type: 'select', options: SCOPES, default: 'business' },
      { key: 'accountId', label: 'Paid from / into', type: 'select', options: () => accounts() },
      { key: 'active', label: 'Active', type: 'check', default: true, checkLabel: 'Count it in fixed costs and due dates' },
      { key: 'notes', label: 'Notes', type: 'textarea', span: 'full', placeholder: 'e.g. Billed on the card ending in 1234' },
    ],
    holdings: [
      { key: 'name', label: 'Name', type: 'text', required: true, span: 'full', placeholder: 'VWCE, Bitcoin, Tezaur 2027' },
      { key: 'kind', label: 'Kind', type: 'select', options: toOptions(CATEGORIES.invest) },
      { key: 'platform', label: 'Platform', type: 'text', placeholder: 'XTB, Revolut, BT' },
      { key: 'opening', label: 'Invested before tracking', type: 'number', default: 0, hint: 'Invest entries logged later are added on top.' },
      { key: 'currentValue', label: 'Current value', type: 'number', required: true, min: 0 },
      { key: 'currency', label: 'Currency', type: 'select', options: CURRENCIES, default: 'RON' },
      { key: 'valueDate', label: 'Value as of', type: 'date', default: todayISO },
      { key: 'notes', label: 'Notes', type: 'textarea', span: 'full', placeholder: 'e.g. Monthly 200 RON plan, rebalanced in January' },
    ],
    accounts: [
      { key: 'name', label: 'Name', type: 'text', required: true, span: 'full', placeholder: 'BT business, Revolut, cash' },
      { key: 'kind', label: 'Kind', type: 'select', options: ACCOUNT_KINDS, default: 'bank' },
      { key: 'currency', label: 'Currency', type: 'select', options: CURRENCIES, default: 'RON' },
      {
        key: 'balance',
        label: 'Balance',
        type: 'number',
        required: true,
        allowNegative: true,
        hint: 'For a credit card or loan, enter the amount owed.',
      },
      { key: 'asOf', label: 'Balance as of', type: 'date', default: todayISO },
      { key: 'notes', label: 'Notes', type: 'textarea', span: 'full', placeholder: 'e.g. IBAN or what the account is used for' },
    ],
    budgets: [
      { key: 'category', label: 'Category', type: 'select', required: true, options: toOptions(CATEGORIES.expense), span: 'full' },
      { key: 'limit', label: 'Monthly limit (RON)', type: 'number', required: true, min: 1, span: 'full', placeholder: '500' },
    ],
  };
}

export const RATE_FIELDS: readonly FieldDef[] = [
  { key: 'eur', label: '1 EUR in RON', type: 'number', required: true, min: 0.0001 },
  { key: 'usd', label: '1 USD in RON', type: 'number', required: true, min: 0.0001 },
];
