import { z } from 'zod';
import { ResourceDef } from '../../lib/resource.js';
import { bani, currency, longText, optionalDate, positiveBani, ref, text } from '../../lib/schemas.js';

/**
 * The tools that used to be saved in the browser. Field names are the API's (camelCase,
 * money in bani); the Angular stores convert to and from their own models.
 */

const txType = z.enum(['income', 'expense', 'invest']);
const scope = z.enum(['personal', 'business']);

export const goals: ResourceDef = {
  name: 'goals',
  table: 'goals',
  positioned: true,
  orderBy: [{ column: 'position' }, { column: 'createdAt' }],
  fields: z.object({
    name: text(200),
    target: text(1000),
    position: z.number().int().min(0),
  }),
};

export const tasks: ResourceDef = {
  name: 'tasks',
  table: 'tasks',
  positioned: true,
  orderBy: [{ column: 'position' }, { column: 'createdAt' }],
  refs: [{ field: 'goalId', table: 'goals' }],
  fields: z.object({
    text: text(2000),
    goalId: ref,
    owner: z.enum(['Founder', 'Marketing & Sales', 'Both', 'Unassigned']),
    prio: z.enum(['High', 'Medium', 'Low']),
    dueMonth: z.number().int().min(1).max(12),
    phase: z.enum(['build', 'prove', 'sell', 'scale']),
    done: z.boolean(),
    notes: longText,
    position: z.number().int().min(0),
  }),
};

export const accounts: ResourceDef = {
  name: 'finances/accounts',
  table: 'fin_accounts',
  orderBy: [{ column: 'name' }],
  fields: z.object({
    name: text(200),
    kind: z.enum(['bank', 'savings', 'cash', 'ewallet', 'card', 'loan']),
    currency,
    // Cards and loans may hold a negative balance (money owed).
    balanceBani: bani,
    asOf: optionalDate,
    notes: longText,
  }),
};

export const holdings: ResourceDef = {
  name: 'finances/holdings',
  table: 'fin_holdings',
  orderBy: [{ column: 'name' }],
  fields: z.object({
    name: text(200),
    kind: text(100),
    platform: text(200),
    openingBani: bani,
    currentValueBani: bani,
    currency,
    valueDate: optionalDate,
    notes: longText,
  }),
};

export const recurring: ResourceDef = {
  name: 'finances/recurring',
  table: 'fin_recurring',
  orderBy: [{ column: 'nextDate', nulls: 'last' }, { column: 'createdAt' }],
  refs: [{ field: 'accountId', table: 'fin_accounts' }],
  fields: z.object({
    type: txType,
    name: text(200),
    amountBani: positiveBani,
    currency,
    frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
    nextDate: optionalDate,
    category: text(100),
    scope,
    accountId: ref,
    active: z.boolean(),
    notes: longText,
  }),
};

export const transactions: ResourceDef = {
  name: 'finances/transactions',
  table: 'fin_transactions',
  orderBy: [{ column: 'date', order: 'desc', nulls: 'last' }, { column: 'createdAt', order: 'desc' }],
  refs: [
    { field: 'accountId', table: 'fin_accounts' },
    { field: 'holdingId', table: 'fin_holdings' },
    { field: 'recurringId', table: 'fin_recurring' },
  ],
  label: (row) => `${row['description'] || row['category'] || 'Entry'} (${Number(row['amountBani']) / 100} ${row['currency']})`,
  fields: z.object({
    type: txType,
    description: text(500),
    amountBani: positiveBani,
    currency,
    date: optionalDate,
    category: text(100),
    scope,
    accountId: ref,
    holdingId: ref,
    recurringId: ref,
    reference: text(200),
    notes: longText,
  }),
};

export const budgets: ResourceDef = {
  name: 'finances/budgets',
  table: 'fin_budgets',
  orderBy: [{ column: 'category' }],
  fields: z.object({
    category: text(100),
    limitBani: positiveBani,
  }),
};

export const posts: ResourceDef = {
  name: 'marketing/posts',
  table: 'mkt_posts',
  orderBy: [{ column: 'month' }, { column: 'createdAt' }],
  fields: z.object({
    title: text(300),
    month: z.number().int().min(1).max(12),
    week: z.number().int().min(0).max(4),
    date: optionalDate,
    format: text(50),
    mix: text(50),
    platforms: z.array(text(50)).max(20),
    count: z.number().int().min(0).max(1000),
    budgetBani: positiveBani,
    status: z.enum(['planned', 'draft', 'ready', 'scheduled', 'published']),
    caption: longText,
    visual: text(5000),
    cta: text(1000),
    keywords: text(2000),
    hashtags: text(2000),
    notes: longText,
  }),
};

export const TOOL_RESOURCES: readonly ResourceDef[] = [goals, tasks, accounts, holdings, recurring, transactions, budgets, posts];
