import type { Knex } from 'knex';

/**
 * Phase 2, module 2: the sales pipeline. A lead is a prospect before it becomes a client + salon.
 * "Convert" links the lead to the new salon; after that the lead's stage follows the salon
 * (trial → trial, active → paying).
 */
const ID = `uuid PRIMARY KEY DEFAULT gen_random_uuid()`;
const STAMPS = `created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()`;

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE leads (
      id                    ${ID},
      business_name         text NOT NULL CHECK (btrim(business_name) <> ''),
      contact_name          text NOT NULL DEFAULT '',
      phone                 text NOT NULL DEFAULT '',
      email                 text NOT NULL DEFAULT '',
      instagram             text NOT NULL DEFAULT '',
      website               text NOT NULL DEFAULT '',
      city                  text NOT NULL DEFAULT '',
      employees             smallint CHECK (employees BETWEEN 0 AND 10000),
      services              text NOT NULL DEFAULT '',
      source                text NOT NULL DEFAULT 'other'
                            CHECK (source IN ('instagram_dm', 'visit', 'email', 'referral', 'phone', 'facebook', 'event', 'other')),
      source_detail         text NOT NULL DEFAULT '',
      stage                 text NOT NULL DEFAULT 'contacted'
                            CHECK (stage IN ('contacted', 'replied', 'demo_booked', 'trial', 'paying', 'lost')),
      stage_position        integer NOT NULL DEFAULT 0,
      next_follow_up_on     date,
      demo_at               timestamptz,
      lost_reason           text CHECK (lost_reason IN ('price', 'no_reply', 'happy_with_current', 'not_ready', 'closed', 'other')),
      lost_note             text NOT NULL DEFAULT '',
      owner_user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
      interested_plan_id    uuid REFERENCES plans(id) ON DELETE SET NULL,
      referred_by_salon_id  uuid REFERENCES salons(id) ON DELETE SET NULL,
      converted_client_id   uuid REFERENCES clients(id) ON DELETE SET NULL,
      converted_salon_id    uuid UNIQUE REFERENCES salons(id) ON DELETE SET NULL,
      converted_at          timestamptz,
      notes                 text NOT NULL DEFAULT '',
      ${STAMPS},
      CHECK (stage <> 'lost' OR lost_reason IS NOT NULL)
    );
    CREATE INDEX leads_stage_idx ON leads (stage, stage_position);
    CREATE INDEX leads_follow_up_idx ON leads (next_follow_up_on);
    CREATE INDEX leads_name_trgm ON leads USING gin (business_name gin_trgm_ops);

    CREATE TABLE lead_activities (
      id           ${ID},
      lead_id      uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
      kind         text NOT NULL CHECK (kind IN ('note', 'dm', 'call', 'email', 'visit', 'stage_change')),
      body         text NOT NULL DEFAULT '',
      from_stage   text,
      to_stage     text,
      occurred_at  timestamptz NOT NULL DEFAULT now(),
      created_at   timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX lead_activities_lead_idx ON lead_activities (lead_id, occurred_at DESC);

    ALTER TABLE salons
      ADD CONSTRAINT salons_lead_fk FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

    CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE salons DROP CONSTRAINT IF EXISTS salons_lead_fk;
    DROP TABLE IF EXISTS lead_activities, leads;
  `);
}
