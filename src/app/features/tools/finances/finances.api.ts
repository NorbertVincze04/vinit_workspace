import { FieldMap, field } from '../../../core/api/api-fields';
import { Account, Budget, Holding, Recurring, Transaction } from './finances.model';

/**
 * How the Finances models map to the API. The app keeps amounts in RON (with decimals);
 * the API stores whole bani. Empty dates and links become null.
 */

export const TRANSACTION_FIELDS: FieldMap<Transaction> = {
  type: field.text(),
  description: field.text(),
  amount: field.money('amountBani'),
  currency: field.text(),
  date: field.date(),
  category: field.text(),
  scope: field.text(),
  accountId: field.ref(),
  holdingId: field.ref(),
  recurringId: field.ref(),
  reference: field.text(),
  notes: field.text(),
};

export const RECURRING_FIELDS: FieldMap<Recurring> = {
  type: field.text(),
  name: field.text(),
  amount: field.money('amountBani'),
  currency: field.text(),
  frequency: field.text(),
  nextDate: field.date(),
  category: field.text(),
  scope: field.text(),
  accountId: field.ref(),
  active: field.bool(),
  notes: field.text(),
};

export const HOLDING_FIELDS: FieldMap<Holding> = {
  name: field.text(),
  kind: field.text(),
  platform: field.text(),
  opening: field.money('openingBani'),
  currentValue: field.money('currentValueBani'),
  currency: field.text(),
  valueDate: field.date(),
  notes: field.text(),
};

export const ACCOUNT_FIELDS: FieldMap<Account> = {
  name: field.text(),
  kind: field.text(),
  currency: field.text(),
  balance: field.money('balanceBani'),
  asOf: field.date(),
  notes: field.text(),
};

export const BUDGET_FIELDS: FieldMap<Budget> = {
  category: field.text(),
  limit: field.money('limitBani'),
};
