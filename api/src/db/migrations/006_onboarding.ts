import type { Knex } from 'knex';

/**
 * Phase 2, module 4: onboarding. Each salon gets one onboarding with a checklist copied from the
 * template. The 48h promise is measured from when the client's materials arrived
 * (materials_received_at, decision 5) to went_live_at; the time before that is "waiting on client".
 */
const ID = `uuid PRIMARY KEY DEFAULT gen_random_uuid()`;
const STAMPS = `created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()`;
const CATEGORY = `text NOT NULL DEFAULT 'setup' CHECK (category IN ('materials', 'session', 'setup', 'launch'))`;

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE onboarding_template_items (
      id           ${ID},
      position     integer NOT NULL DEFAULT 0,
      title        text NOT NULL CHECK (btrim(title) <> ''),
      description  text NOT NULL DEFAULT '',
      category     ${CATEGORY},
      ${STAMPS}
    );

    CREATE TABLE onboardings (
      id                     ${ID},
      salon_id               uuid NOT NULL UNIQUE REFERENCES salons(id) ON DELETE CASCADE,
      signed_at              timestamptz NOT NULL,
      materials_received_at  timestamptz,
      went_live_at           timestamptz,
      status                 text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'blocked', 'done')),
      blocked_reason         text NOT NULL DEFAULT '',
      notes                  text NOT NULL DEFAULT '',
      ${STAMPS},
      CHECK (materials_received_at IS NULL OR materials_received_at >= signed_at - interval '30 days'),
      CHECK (went_live_at IS NULL OR materials_received_at IS NULL OR went_live_at >= materials_received_at),
      CHECK (status <> 'done' OR went_live_at IS NOT NULL),
      CHECK (status <> 'blocked' OR btrim(blocked_reason) <> '')
    );
    CREATE INDEX onboardings_status_idx ON onboardings (status);

    CREATE TABLE onboarding_steps (
      id             ${ID},
      onboarding_id  uuid NOT NULL REFERENCES onboardings(id) ON DELETE CASCADE,
      position       integer NOT NULL DEFAULT 0,
      title          text NOT NULL CHECK (btrim(title) <> ''),
      description    text NOT NULL DEFAULT '',
      category       ${CATEGORY},
      done_at        timestamptz,
      done_by        uuid REFERENCES users(id) ON DELETE SET NULL,
      note           text NOT NULL DEFAULT '',
      created_at     timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX onboarding_steps_onboarding_idx ON onboarding_steps (onboarding_id, position);

    -- The four steps of the onboarding sheet (under 48h): materials, kickoff, setup, approval, launch.
    INSERT INTO onboarding_template_items (position, category, title, description) VALUES
      (0, 'materials', 'Logo', 'Vector or high-resolution file.'),
      (1, 'materials', 'Brand colours', 'Main and accent colours (hex codes if they have them).'),
      (2, 'materials', 'Services with durations and prices', ''),
      (3, 'materials', 'Opening hours and barbers', 'Who works when; photo and name of each barber.'),
      (4, 'materials', 'Photos of the salon', ''),
      (5, 'materials', 'Domain the salon wants', 'Check it is free; note who owns it.'),
      (6, 'session', 'Kickoff session (30 min)', 'Included session 1: walk through the materials and wishes.'),
      (7, 'setup', 'Write the JSON config', 'Tenant config in the booking product.'),
      (8, 'setup', 'Connect the domain (DNS + SSL)', ''),
      (9, 'session', 'Prototype approval session (30 min)', 'Included session 2: the owner approves the site.'),
      (10, 'launch', 'Test booking end to end', 'Book, receive the confirmation, cancel.'),
      (11, 'launch', 'Handover and launch', 'Owner portal access, QR stand, announce on Instagram.');

    CREATE TRIGGER onboarding_template_items_updated_at BEFORE UPDATE ON onboarding_template_items FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
    CREATE TRIGGER onboardings_updated_at BEFORE UPDATE ON onboardings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TABLE IF EXISTS onboarding_steps, onboardings, onboarding_template_items;`);
}
