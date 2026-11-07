import type { Knex } from 'knex';
import { HttpError, notFound } from '../../http/errors.js';
import { logActivity } from '../../lib/activity.js';
import type { SalonStatus } from './salons.schemas.js';

type Db = Knex | Knex.Transaction;
type Row = Record<string, unknown>;

/** Today in Bucharest as "YYYY-MM-DD" (the server may run in another timezone). */
export function todayBucharest(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Bucharest' });
}

/**
 * Salon rows as lists show them: the salon plus its client, plan and primary domain.
 * Later modules add their own figures with addSalonColumns().
 */
export function salonRows(k: Db): Knex.QueryBuilder {
  const q = k('salons as s')
    .join('clients as c', 'c.id', 's.clientId')
    .leftJoin('plans as p', 'p.id', 's.planId')
    .leftJoin('salonDomains as d', function () {
      this.on('d.salonId', '=', 's.id').andOnVal('d.isPrimary', '=', true);
    })
    .select(
      's.*',
      'c.name as clientName',
      'c.kind as clientKind',
      'c.email as clientEmail',
      'c.phone as clientPhone',
      k.raw('(c.business_address IS NULL) as client_address_missing'),
      'p.code as planCode',
      'p.name as planName',
      'd.domain as primaryDomain',
    );
  for (const add of columnAdders) add(q, k);
  return q;
}

type ColumnAdder = (q: Knex.QueryBuilder, k: Db) => void;
const columnAdders: ColumnAdder[] = [];

/** Lets a module (subscriptions, onboarding, tickets) add summary columns to every salon row. */
export function addSalonColumns(adder: ColumnAdder): void {
  columnAdders.push(adder);
}

export async function getSalonRow(k: Db, id: string): Promise<Row> {
  const row = await salonRows(k).where('s.id', id).first();
  if (!row) throw notFound('Salon');
  return row;
}

type StatusListener = (trx: Knex.Transaction, salon: Row, to: SalonStatus) => Promise<void>;
const statusListeners: StatusListener[] = [];

/** Called after every salon status change, in the same transaction (e.g. leads follow their salon). */
export function onSalonStatus(listener: StatusListener): void {
  statusListeners.push(listener);
}

export interface StatusChangeInput {
  userId?: string | null;
  on?: string | null;
  reason?: string;
}

/**
 * The one way a salon's status changes: updates the salon, writes the history (basis for churn and
 * retention) and the activity log, then lets other modules react. No-op when the status is unchanged.
 */
export async function setSalonStatus(
  trx: Knex.Transaction,
  salonId: string,
  to: SalonStatus,
  input: StatusChangeInput = {},
): Promise<Row> {
  const salon = await trx('salons').where({ id: salonId }).forUpdate().first();
  if (!salon) throw notFound('Salon');
  if (salon.status === to) return salon;

  const on = input.on || todayBucharest();
  const reason = (input.reason ?? '').trim();
  const patch: Row = { status: to };
  if (to === 'churned') Object.assign(patch, { churnedOn: on, churnReason: reason });
  else if (salon.status === 'churned') Object.assign(patch, { churnedOn: null, churnReason: '' });

  const [updated] = await trx('salons').where({ id: salonId }).update(patch).returning('*');
  await trx('salonStatusHistory').insert({
    salonId,
    fromStatus: salon.status,
    toStatus: to,
    changedOn: on,
    changedBy: input.userId ?? null,
    reason,
  });
  await logActivity(trx, {
    userId: input.userId,
    entityType: 'salons',
    entityId: salonId,
    salonId,
    action: 'status_changed',
    summary: `${salon.name}: ${salon.status} → ${to}${reason ? ` (${reason})` : ''}`,
    data: { from: salon.status, to, on },
  });
  for (const listener of statusListeners) await listener(trx, updated, to);
  return updated;
}

/** Makes one domain the salon's primary (the others lose the flag). */
export async function makePrimaryDomain(trx: Knex.Transaction, salonId: string, domainId: string): Promise<void> {
  await trx('salonDomains').where({ salonId }).whereNot({ id: domainId }).update({ isPrimary: false });
  await trx('salonDomains').where({ id: domainId }).update({ isPrimary: true });
}

/** 409 with a readable message (instead of the generic foreign-key one). */
export const inUse = (message: string): HttpError => new HttpError(409, 'in_use', message);
