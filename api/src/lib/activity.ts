import type { Knex } from 'knex';

export interface ActivityEntry {
  userId?: string | null;
  entityType: string;
  entityId?: string | null;
  salonId?: string | null;
  action: string;
  summary?: string;
  data?: Record<string, unknown>;
}

/** Appends to the activity log. Pass the transaction so the entry commits (or rolls back) with the change. */
export async function logActivity(trx: Knex | Knex.Transaction, entry: ActivityEntry): Promise<void> {
  await trx('activity_log').insert({
    userId: entry.userId ?? null,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    salonId: entry.salonId ?? null,
    action: entry.action,
    summary: (entry.summary ?? '').slice(0, 300),
    data: JSON.stringify(entry.data ?? {}),
  });
}
