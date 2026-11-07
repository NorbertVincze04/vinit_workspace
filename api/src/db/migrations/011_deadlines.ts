import type { Knex } from 'knex';

/**
 * Phase 3, module 4: deadlines. Manual ones (tax, accounting, funding…) and ones generated from the
 * data (domain/SSL expiry, contract renewal, trial end, minimum term end; infra renewals later).
 * Generated rows are keyed by (source_type, source_id, due_on), so regenerating is idempotent.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE deadlines (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title        text NOT NULL CHECK (btrim(title) <> ''),
      category     text NOT NULL DEFAULT 'other' CHECK (category IN ('domain_renewal', 'contract_renewal', 'trial_end', 'tax',
                                                                    'accounting', 'funding', 'service_subscription', 'other')),
      due_on       date NOT NULL,
      salon_id     uuid REFERENCES salons(id) ON DELETE CASCADE,
      recurrence   text NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'monthly', 'quarterly', 'yearly')),
      -- Remind this many days before (and on the day: 0).
      remind_days  integer[] NOT NULL DEFAULT '{14,3,0}',
      -- Set for generated deadlines: what they come from.
      source_type  text,
      source_id    uuid,
      status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dismissed')),
      done_at      timestamptz,
      url          text NOT NULL DEFAULT '',
      notes        text NOT NULL DEFAULT '',
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now(),
      CHECK ((source_type IS NULL) = (source_id IS NULL))
    );
    CREATE UNIQUE INDEX deadlines_source_idx ON deadlines (source_type, source_id, due_on) WHERE source_type IS NOT NULL;
    CREATE INDEX deadlines_due_idx ON deadlines (due_on);

    CREATE TRIGGER deadlines_updated_at BEFORE UPDATE ON deadlines FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS deadlines');
}
