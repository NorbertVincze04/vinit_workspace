import type { Knex } from 'knex';

/**
 * Foundation: extensions, the updated_at trigger function, users, settings and the activity log.
 * Raw SQL on purpose: CHECK constraints, partial indexes and triggers read best as SQL.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE EXTENSION IF NOT EXISTS citext;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE EXTENSION IF NOT EXISTS unaccent;

    -- Keeps updated_at current on every UPDATE. Attached to each table with set_updated_at(<table>).
    CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TABLE users (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email          citext NOT NULL UNIQUE CHECK (email ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'),
      full_name      text NOT NULL CHECK (length(full_name) BETWEEN 1 AND 120),
      password_hash  text NOT NULL,
      role           text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
      is_active      boolean NOT NULL DEFAULT true,
      -- Bumped to sign out every session of the user (password change).
      token_version  integer NOT NULL DEFAULT 0,
      last_login_at  timestamptz,
      created_at     timestamptz NOT NULL DEFAULT now(),
      updated_at     timestamptz NOT NULL DEFAULT now()
    );
    CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

    -- Small typed values shared by the whole team (plan start month, exchange rates, targets…).
    CREATE TABLE app_settings (
      key         text PRIMARY KEY,
      value       jsonb NOT NULL,
      updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

    -- Who did what, when. salon_id gets its foreign key once the salons table exists (Phase 2).
    CREATE TABLE activity_log (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      occurred_at  timestamptz NOT NULL DEFAULT now(),
      user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
      entity_type  text NOT NULL,
      entity_id    text,
      salon_id     uuid,
      action       text NOT NULL,
      summary      text NOT NULL DEFAULT '',
      data         jsonb NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE INDEX activity_log_occurred_idx ON activity_log (occurred_at DESC);
    CREATE INDEX activity_log_entity_idx ON activity_log (entity_type, entity_id);
    CREATE INDEX activity_log_salon_idx ON activity_log (salon_id, occurred_at DESC) WHERE salon_id IS NOT NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TABLE IF EXISTS activity_log;
    DROP TABLE IF EXISTS app_settings;
    DROP TABLE IF EXISTS users;
    DROP FUNCTION IF EXISTS touch_updated_at();
  `);
}
