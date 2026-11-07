import type { Knex } from 'knex';

/**
 * Phase 2, module 5: support tickets and time tracking.
 *
 * - Included sessions are counted per meeting (decision 4): one 'included_session' entry is one
 *   session, whatever its length. They are one-time per contract (Standard/Premium 2, Custom 3).
 * - Billable time is exact minutes × rate (100 RON/h by default); "bill extra work" turns the
 *   unbilled entries into one extra_work payment and links them to it.
 */
const ID = `uuid PRIMARY KEY DEFAULT gen_random_uuid()`;
const STAMPS = `created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()`;
const TODAY = `((now() AT TIME ZONE 'Europe/Bucharest')::date)`;

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE tickets (
      id            ${ID},
      -- Readable number for conversations: T-0042.
      number        integer GENERATED ALWAYS AS IDENTITY UNIQUE,
      salon_id      uuid NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
      title         text NOT NULL CHECK (btrim(title) <> ''),
      description   text NOT NULL DEFAULT '',
      type          text NOT NULL DEFAULT 'question' CHECK (type IN ('bug', 'change_request', 'question')),
      status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_client', 'resolved', 'closed')),
      priority      text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      reported_via  text NOT NULL DEFAULT 'whatsapp'
                    CHECK (reported_via IN ('whatsapp', 'phone', 'email', 'instagram', 'in_person', 'other')),
      assignee_id   uuid REFERENCES users(id) ON DELETE SET NULL,
      opened_at     timestamptz NOT NULL DEFAULT now(),
      resolved_at   timestamptz,
      closed_at     timestamptz,
      ${STAMPS}
    );
    CREATE INDEX tickets_salon_idx ON tickets (salon_id, status);
    CREATE INDEX tickets_status_idx ON tickets (status, priority);

    CREATE TABLE time_entries (
      id                 ${ID},
      salon_id           uuid NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
      ticket_id          uuid REFERENCES tickets(id) ON DELETE SET NULL,
      onboarding_id      uuid REFERENCES onboardings(id) ON DELETE SET NULL,
      user_id            uuid REFERENCES users(id) ON DELETE SET NULL,
      worked_on          date NOT NULL DEFAULT ${TODAY},
      minutes            integer NOT NULL CHECK (minutes > 0 AND minutes <= 1440),
      kind               text NOT NULL CHECK (kind IN ('included_session', 'billable', 'internal')),
      rate_bani          integer NOT NULL DEFAULT 10000 CHECK (rate_bani >= 0),
      description        text NOT NULL DEFAULT '',
      billed_payment_id  uuid REFERENCES payments(id) ON DELETE SET NULL,
      ${STAMPS}
    );
    CREATE INDEX time_entries_salon_idx ON time_entries (salon_id, kind);
    CREATE INDEX time_entries_ticket_idx ON time_entries (ticket_id);

    CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
    CREATE TRIGGER time_entries_updated_at BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS time_entries, tickets;`);
}
