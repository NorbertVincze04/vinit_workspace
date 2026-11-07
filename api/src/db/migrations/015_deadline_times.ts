import type { Knex } from 'knex';

/**
 * Deadlines like a phone calendar: all day or at a time (Bucharest time), and reminders as minutes
 * before (5 min … 1 week). All-day reminders go off at 09:00. Existing "days before" reminders are
 * converted exactly (3 days → 4320 minutes).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE deadlines
      ADD COLUMN all_day   boolean NOT NULL DEFAULT true,
      ADD COLUMN due_time  time,
      ADD COLUMN reminders integer[] NOT NULL DEFAULT '{10080,1440,0}';
    UPDATE deadlines SET reminders = coalesce((SELECT array_agg(d * 1440 ORDER BY d DESC) FROM unnest(remind_days) AS d), '{}');
    ALTER TABLE deadlines
      DROP COLUMN remind_days,
      ADD CONSTRAINT deadlines_time_check CHECK (all_day = (due_time IS NULL)),
      ADD CONSTRAINT deadlines_reminders_check CHECK (0 <= ALL (reminders) AND 525600 >= ALL (reminders) AND cardinality(reminders) <= 10);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE deadlines ADD COLUMN remind_days integer[] NOT NULL DEFAULT '{14,3,0}';
    UPDATE deadlines SET remind_days = coalesce((SELECT array_agg(DISTINCT m / 1440) FROM unnest(reminders) AS m), '{}');
    ALTER TABLE deadlines DROP CONSTRAINT deadlines_time_check, DROP CONSTRAINT deadlines_reminders_check,
      DROP COLUMN all_day, DROP COLUMN due_time, DROP COLUMN reminders;
  `);
}
