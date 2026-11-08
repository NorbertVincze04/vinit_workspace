import { Injectable, computed, signal } from '@angular/core';
import { Entity } from '../../../core/models';
import { addPeriod, daysUntil, formatDate, monthName, shiftMonth, todayISO } from '../../../core/utils/date';
import { formatMoney, formatRon } from '../../../core/utils/format';
import { ApiCollection, apiCollection } from '../../../core/api/api-collection';
import { remoteSetting } from '../../../core/api/remote-setting';
import { persistedSignal } from '../../../core/utils/persisted-signal';
import { matchesSearch } from '../../../core/utils/text';
import { ChartGroup } from '../../../shared/components';
import { ChipOption, InlineStat, SelectOption, StatusTone } from '../../../shared/ui';
import {
  ACCOUNT_KINDS,
  DEFAULT_RATES,
  FINANCE_TABS,
  FREQUENCIES,
  FinanceCollection,
  LIABILITY_KINDS,
  PER_MONTH,
  SCOPES,
  TX_TYPES,
  TxType,
  labelOf,
} from './finances.data';
import { ACCOUNT_FIELDS, BUDGET_FIELDS, HOLDING_FIELDS, RECURRING_FIELDS, TRANSACTION_FIELDS } from './finances.api';
import {
  Account,
  AccountRow,
  Budget,
  BudgetRow,
  CategorySpend,
  FinanceBackup,
  Holding,
  HoldingRow,
  Rates,
  Recurring,
  RecurringRow,
  Totals,
  Transaction,
  TxFilters,
  TxRow,
} from './finances.model';
import { countOf, locale, t } from '../../../core/i18n/i18n';

const isRates = (v: unknown): v is Rates => {
  const r = v as Partial<Rates> | null;
  return !!r && Number(r.eur) > 0 && Number(r.usd) > 0;
};
const isTab = (v: unknown): v is FinanceCollection => FINANCE_TABS.some((t) => t.value === v);
const signedRon = (n: number): string => formatRon(n, true);
const TYPE_TONE: Record<TxType, StatusTone> = { income: 'ok', expense: 'warn', invest: 'info' };
const TYPE_SIGN: Record<TxType, string> = { income: '+', expense: '−', invest: '' };

/**
 * Finances tool state: five saved collections, exchange rates and every derived figure.
 * Saved on the server (/api/v1/finances/*); the open tab is remembered per device.
 */
@Injectable({ providedIn: 'root' })
export class FinancesStore {
  readonly transactions = apiCollection<Transaction>('/finances/transactions', TRANSACTION_FIELDS, 'tx');
  readonly recurring = apiCollection<Recurring>('/finances/recurring', RECURRING_FIELDS, 'rc');
  readonly holdings = apiCollection<Holding>('/finances/holdings', HOLDING_FIELDS, 'hd');
  readonly accounts = apiCollection<Account>('/finances/accounts', ACCOUNT_FIELDS, 'ac');
  readonly budgets = apiCollection<Budget>('/finances/budgets', BUDGET_FIELDS, 'bd');
  readonly rates = remoteSetting<Rates>('finances.rates', () => ({ ...DEFAULT_RATES }), isRates);

  /** Selected month "YYYY-MM". */
  readonly month = signal(todayISO().slice(0, 7));
  readonly tab = persistedSignal<FinanceCollection>('finances.tab', () => 'transactions', { validate: isTab });
  readonly txFilters = signal<TxFilters>({ type: 'all', scope: 'all', period: 'month', q: '' });

  // ---------------------------------------------------------------- overview

  readonly monthTotals = computed(() => this.sums(this.txIn(this.month())));
  readonly prevTotals = computed(() => this.sums(this.txIn(shiftMonth(this.month(), -1))));

  /** Business (VINIT) income minus expenses in the current calendar month. */
  readonly businessThisMonth = computed(() => {
    const t = this.sums(this.txIn(todayISO().slice(0, 7)).filter((x) => x.scope === 'business'));
    return { ...t, result: t.income - t.expense };
  });

  readonly netWorth = computed(() => {
    let assets = 0;
    let debts = 0;
    let invested = 0;
    for (const a of this.accounts.items()) {
      const v = this.toRON(a.balance, a.currency);
      if (LIABILITY_KINDS.includes(a.kind)) debts += Math.abs(v);
      else assets += v;
    }
    for (const h of this.holdings.items()) invested += this.toRON(h.currentValue, h.currency);
    return { assets, debts, invested, total: assets + invested - debts };
  });

  readonly chartGroups = computed<ChartGroup[]>(() => {
    const months = Array.from({ length: 6 }, (_, i) => shiftMonth(this.month(), i - 5));
    return months.map((ym) => {
      const t = this.sums(this.txIn(ym));
      return {
        key: ym,
        label: monthName(ym, true),
        title: monthName(ym),
        values: { income: t.income, expense: t.expense, invest: t.invest },
        selected: ym === this.month(),
        extra: [{ label: 'Left over', value: signedRon(t.income - t.expense - t.invest) }],
      };
    });
  });

  readonly categorySpend = computed(() => {
    const spent = this.spentByCategory(this.month());
    const budgets = new Map<string, number>();
    for (const b of this.budgets.items()) budgets.set(b.category, (budgets.get(b.category) ?? 0) + (Number(b.limit) || 0));
    const names = new Set([...spent.keys(), ...budgets.keys()]);
    const rows: CategorySpend[] = [...names]
      .map((name) => {
        const s = spent.get(name) ?? 0;
        const b = budgets.get(name) ?? null;
        return { name, spent: s, budget: b, over: b !== null && s > b };
      })
      .sort((a, b) => b.spent - a.spent || (b.budget ?? 0) - (a.budget ?? 0));
    return { rows: rows.slice(0, 8), hidden: Math.max(0, rows.length - 8) };
  });

  readonly tabOptions = computed<ChipOption[]>(() =>
    FINANCE_TABS.map((t) => ({ ...t, count: this.collection(t.value as FinanceCollection).items().length })),
  );

  readonly accountOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'None' },
    ...[...this.accounts.items()]
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
      .map((a) => ({ value: a.id, label: a.name || 'Untitled account' })),
  ]);

  readonly holdingOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'None' },
    ...this.holdings.items().map((h) => ({ value: h.id, label: h.name || 'Untitled investment' })),
  ]);

  // ---------------------------------------------------------------- transactions

  readonly visibleTx = computed(() => {
    const f = this.txFilters();
    return this.transactions
      .items()
      .filter((t) => f.period === 'all' || (t.date || '').slice(0, 7) === this.month())
      .filter((t) => f.type === 'all' || t.type === f.type)
      .filter((t) => f.scope === 'all' || (t.scope || 'personal') === f.scope)
      .filter((t) => matchesSearch(f.q, t.description, t.category, t.reference, t.notes, this.accountName(t.accountId)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt.localeCompare(a.createdAt));
  });

  readonly txRows = computed<TxRow[]>(() => {
    const showYear = this.txFilters().period === 'all';
    return this.visibleTx().map((tx) => {
      const d = new Date(`${tx.date || todayISO()}T00:00:00`);
      const valid = !Number.isNaN(d.getTime());
      const holding = tx.holdingId ? this.holdings.get(tx.holdingId) : undefined;
      return {
        tx,
        day: valid ? String(d.getDate()) : '–',
        monthText: valid
          ? d.toLocaleDateString(locale(), { month: 'short' }) + (showYear ? ` ${String(d.getFullYear()).slice(2)}` : '')
          : '',
        sub: [t(tx.category), this.accountName(tx.accountId), holding?.name, tx.reference].filter(Boolean).join(' · '),
        typeLabel: labelOf(TX_TYPES, tx.type),
        typeTone: TYPE_TONE[tx.type] ?? 'neutral',
        business: tx.scope === 'business',
        amountText: `${TYPE_SIGN[tx.type] ?? ''}${formatMoney(tx.amount, tx.currency)}`,
        amountClass: tx.type,
        ronText: tx.currency !== 'RON' ? `≈ ${formatRon(this.toRON(tx.amount, tx.currency))}` : '',
      };
    });
  });

  readonly txSummary = computed<InlineStat[]>(() => {
    const rows = this.visibleTx();
    const t = this.sums(rows);
    return [
      { label: rows.length === 1 ? 'Entry' : 'Entries', value: String(rows.length) },
      { label: 'In', value: formatRon(t.income) },
      { label: 'Out', value: formatRon(t.expense) },
      { label: 'Invested', value: formatRon(t.invest) },
    ];
  });

  // ---------------------------------------------------------------- recurring

  readonly recurringRows = computed<RecurringRow[]>(() =>
    [...this.recurring.items()]
      .sort((a, b) => Number(b.active) - Number(a.active) || (a.nextDate || '').localeCompare(b.nextDate || ''))
      .map((r) => {
        const due = this.dueState(r);
        return {
          item: r,
          sub: [labelOf(FREQUENCIES, r.frequency), t(r.category), r.scope === 'business' ? 'VINIT' : ''].filter(Boolean).join(' · '),
          dueText: formatDate(r.nextDate),
          dueLabel: due.label,
          dueTone: due.tone,
          amountText: `${TYPE_SIGN[r.type] ?? ''}${formatMoney(r.amount, r.currency)}`,
          amountClass: r.type,
          perMonthText: r.active ? formatRon(this.perMonth(r)) : '–',
          canLog: r.active && !!r.nextDate,
        };
      }),
  );

  /** Active recurring payments that are overdue or due within the next 14 days. */
  readonly dueSoon = computed<RecurringRow[]>(() =>
    this.recurringRows().filter((row) => row.canLog && daysUntil(row.item.nextDate) <= 14),
  );

  readonly recurringSummary = computed<InlineStat[]>(() => {
    let out = 0;
    let inc = 0;
    let inv = 0;
    let dueSoon = 0;
    for (const r of this.recurring.items()) {
      if (!r.active) continue;
      const v = this.perMonth(r);
      if (r.type === 'income') inc += v;
      else if (r.type === 'invest') inv += v;
      else out += v;
      if (r.nextDate && daysUntil(r.nextDate) <= 7) dueSoon++;
    }
    const items: InlineStat[] = [
      { label: 'Fixed costs', value: formatRon(out), suffix: '/ month' },
      { label: 'Recurring income', value: formatRon(inc), suffix: '/ month' },
    ];
    if (inv) items.push({ label: 'Auto-invest', value: formatRon(inv), suffix: '/ month' });
    items.push({ label: 'Due within 7 days', value: String(dueSoon) });
    return items;
  });

  // ---------------------------------------------------------------- holdings

  readonly holdingRows = computed<HoldingRow[]>(() =>
    this.holdings
      .items()
      .map((h) => {
        const invested = this.holdingInvested(h);
        const value = this.toRON(h.currentValue, h.currency);
        const gain = value - invested;
        return {
          item: h,
          value,
          row: {
            item: h,
            sub: [t(h.kind), h.platform, h.valueDate ? t('value {date}', { date: formatDate(h.valueDate, { day: 'numeric', month: 'short' }) }) : '']
              .filter(Boolean)
              .join(' · '),
            investedText: formatRon(invested),
            valueText: formatMoney(h.currentValue, h.currency),
            ronText: h.currency !== 'RON' ? `≈ ${formatRon(value)}` : '',
            gainText: signedRon(gain),
            gainPctText: invested ? `${gain >= 0 ? '+' : ''}${((gain / invested) * 100).toFixed(1)}%` : '',
            gainNegative: gain < 0,
          },
        };
      })
      .sort((a, b) => b.value - a.value)
      .map((x) => x.row),
  );

  readonly holdingSummary = computed<InlineStat[]>(() => {
    let invested = 0;
    let worth = 0;
    for (const h of this.holdings.items()) {
      invested += this.holdingInvested(h);
      worth += this.toRON(h.currentValue, h.currency);
    }
    const gain = worth - invested;
    return [
      { label: 'Invested', value: formatRon(invested) },
      { label: 'Worth now', value: formatRon(worth) },
      {
        label: 'Return',
        value: signedRon(gain) + (invested ? ` (${((gain / invested) * 100).toFixed(1)}%)` : ''),
        tone: gain < 0 ? 'negative' : 'positive',
      },
    ];
  });

  // ---------------------------------------------------------------- accounts

  readonly accountRows = computed<AccountRow[]>(() => {
    const month = this.month();
    return [...this.accounts.items()]
      .sort((a, b) => {
        const la = Number(LIABILITY_KINDS.includes(a.kind));
        const lb = Number(LIABILITY_KINDS.includes(b.kind));
        return la - lb || this.toRON(b.balance, b.currency) - this.toRON(a.balance, a.currency);
      })
      .map((a) => {
        const liability = LIABILITY_KINDS.includes(a.kind);
        const used = this.transactions.items().filter((t) => t.accountId === a.id && (t.date || '').slice(0, 7) === month).length;
        const abs = Math.abs(Number(a.balance) || 0);
        return {
          item: a,
          sub: [a.asOf ? t('Balance as of {date}', { date: formatDate(a.asOf) }) : '', used ? t('{n} entries this month', { n: used }) : ''].filter(Boolean).join(' · '),
          kindLabel: labelOf(ACCOUNT_KINDS, a.kind),
          kindTone: liability ? 'bad' : a.kind === 'savings' ? 'ok' : 'neutral',
          balanceText: `${liability ? '−' : ''}${formatMoney(abs, a.currency)}`,
          ronText: a.currency !== 'RON' ? `≈ ${formatRon(this.toRON(abs, a.currency))}` : '',
          liability,
        };
      });
  });

  readonly accountSummary = computed<InlineStat[]>(() => [
    { label: 'Money held', value: formatRon(this.netWorth().assets) },
    { label: 'Owed', value: formatRon(this.netWorth().debts) },
  ]);

  // ---------------------------------------------------------------- budgets

  readonly budgetRows = computed<BudgetRow[]>(() => {
    const spent = this.spentByCategory(this.month());
    return [...this.budgets.items()]
      .sort((a, b) => a.category.localeCompare(b.category, 'ro'))
      .map((b) => {
        const limit = Number(b.limit) || 0;
        const s = spent.get(b.category) ?? 0;
        const left = limit - s;
        return {
          item: b,
          spentText: formatRon(s),
          pct: limit ? Math.round((s / limit) * 100) : 0,
          leftText: left < 0 ? t('Over by {amount}', { amount: formatRon(-left) }) : formatRon(left),
          over: left < 0,
          limitText: t('{amount} a month', { amount: formatRon(limit) }),
        };
      });
  });

  readonly budgetSummary = computed<InlineStat[]>(() => {
    const spent = this.spentByCategory(this.month());
    let limit = 0;
    let used = 0;
    for (const b of this.budgets.items()) {
      limit += Number(b.limit) || 0;
      used += spent.get(b.category) ?? 0;
    }
    return [
      { label: t('{month}: spent', { month: monthName(this.month()) }), value: formatRon(used) },
      { label: 'of', value: formatRon(limit), suffix: 'budgeted' },
    ];
  });

  // ---------------------------------------------------------------- actions

  collection(name: FinanceCollection): ApiCollection<Entity> {
    return this[name] as unknown as ApiCollection<Entity>;
  }

  /** Adds (id = null) or updates a record from validated form values. */
  save(name: FinanceCollection, id: string | null, values: object): void {
    const data = values as never;
    if (id) this.collection(name).update(id, data);
    else this.collection(name).add(data);
  }

  remove(name: FinanceCollection, id: string): void {
    this.collection(name).remove(id);
  }

  setTxFilters(patch: Partial<TxFilters>): void {
    this.txFilters.update((f) => ({ ...f, ...patch }));
  }

  /** Logs a recurring payment as a transaction and moves its due date forward. */
  logRecurring(r: Recurring): string {
    this.transactions.add({
      type: r.type,
      date: r.nextDate || todayISO(),
      description: r.name || 'Recurring payment',
      amount: Number(r.amount) || 0,
      currency: r.currency,
      category: r.category,
      scope: r.scope,
      accountId: r.accountId,
      holdingId: '',
      reference: '',
      notes: 'Logged from recurring',
      recurringId: r.id,
    });
    const next = addPeriod(r.nextDate || todayISO(), r.frequency);
    this.recurring.update(r.id, { nextDate: next });
    return next;
  }

  setRates(rates: Rates): void {
    if (isRates(rates)) this.rates.set({ eur: Number(rates.eur), usd: Number(rates.usd) });
  }

  toRON(amount: number, currency: string): number {
    const n = Number(amount) || 0;
    const r = this.rates();
    return currency === 'EUR' ? n * r.eur : currency === 'USD' ? n * r.usd : n;
  }

  /** CSV rows for the transactions currently shown. */
  csvRows(): string[][] {
    const header = ['Date', 'Type', 'Description', 'Category', 'Scope', 'Account', 'Amount', 'Currency', 'Amount RON', 'Reference', 'Notes'];
    return [
      header,
      ...this.visibleTx().map((t) => [
        t.date,
        labelOf(TX_TYPES, t.type),
        t.description,
        t.category,
        labelOf(SCOPES, t.scope),
        this.accountName(t.accountId),
        String(t.amount),
        t.currency,
        this.toRON(t.amount, t.currency).toFixed(2),
        t.reference,
        t.notes,
      ]),
    ];
  }

  snapshot(): FinanceBackup {
    return {
      transactions: [...this.transactions.items()],
      recurring: [...this.recurring.items()],
      holdings: [...this.holdings.items()],
      accounts: [...this.accounts.items()],
      budgets: [...this.budgets.items()],
      rates: this.rates(),
    };
  }

  importState(data: unknown): boolean {
    const d = data as Partial<FinanceBackup> | null;
    // Records others link to go first, so transactions keep their account / holding / recurring links.
    // (Writes reach the server in this order.)
    const names: FinanceCollection[] = ['accounts', 'holdings', 'recurring', 'transactions', 'budgets'];
    if (!d || !names.every((n) => Array.isArray(d[n]))) return false;
    for (const n of names) void this.collection(n).replaceAll(d[n] as Entity[]).catch(() => undefined);
    if (isRates(d.rates)) this.rates.set(d.rates);
    return true;
  }

  // ---------------------------------------------------------------- helpers

  private txIn(ym: string): Transaction[] {
    return this.transactions.items().filter((t) => (t.date || '').slice(0, 7) === ym);
  }

  private sums(list: readonly Transaction[]): Totals {
    const totals: Totals = { income: 0, expense: 0, invest: 0 };
    for (const t of list) if (t.type in totals) totals[t.type] += this.toRON(t.amount, t.currency);
    return totals;
  }

  private spentByCategory(ym: string): Map<string, number> {
    const spent = new Map<string, number>();
    for (const t of this.txIn(ym)) {
      if (t.type !== 'expense') continue;
      const c = t.category || 'Other';
      spent.set(c, (spent.get(c) ?? 0) + this.toRON(t.amount, t.currency));
    }
    return spent;
  }

  private holdingInvested(h: Holding): number {
    const contributions = this.transactions
      .items()
      .filter((t) => t.type === 'invest' && t.holdingId === h.id)
      .reduce((sum, t) => sum + this.toRON(t.amount, t.currency), 0);
    return this.toRON(h.opening, h.currency) + contributions;
  }

  private perMonth(r: Recurring): number {
    return this.toRON(r.amount, r.currency) * (PER_MONTH[r.frequency] ?? 1);
  }

  private accountName(id: string): string {
    return id ? (this.accounts.get(id)?.name ?? '') : '';
  }

  private dueState(r: Recurring): { label: string; tone: StatusTone } {
    if (!r.active) return { label: t('Paused'), tone: 'neutral' };
    if (!r.nextDate) return { label: t('No date'), tone: 'neutral' };
    const d = daysUntil(r.nextDate);
    if (d < 0) return { label: t('Overdue {n}d', { n: -d }), tone: 'bad' };
    if (d === 0) return { label: t('Due today'), tone: 'warn' };
    if (d <= 7) return { label: t('In {days}', { days: countOf(d, 'day', 'days') }), tone: 'warn' };
    return { label: t('In {days}', { days: countOf(d, 'day', 'days') }), tone: 'neutral' };
  }
}
