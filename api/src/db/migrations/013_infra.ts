import type { Knex } from 'knex';

/**
 * Phase 3, module 6: infrastructure. The services the business pays for (hosting, SMS, domains,
 * tools); decision G: a service linked to a Finances recurring payment takes its cost from there.
 * SMS usage per month (against the ~1,500 SMS budget) and a log of backups and restore tests.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE infra_services (
      id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name                  text NOT NULL CHECK (btrim(name) <> ''),
      vendor                text NOT NULL DEFAULT '',
      category              text NOT NULL DEFAULT 'other' CHECK (category IN ('hosting', 'database', 'sms', 'domain', 'email', 'tooling', 'other')),
      plan_name             text NOT NULL DEFAULT '',
      -- Only used when the service is not linked to a Finances recurring payment.
      monthly_cost_bani     integer CHECK (monthly_cost_bani >= 0),
      currency              text NOT NULL DEFAULT 'RON' CHECK (currency IN ('RON', 'EUR', 'USD')),
      recurring_id          text REFERENCES fin_recurring(id) ON DELETE SET NULL,
      renews_on             date,
      dashboard_url         text NOT NULL DEFAULT '',
      status_url            text NOT NULL DEFAULT '',
      -- Where the login lives in the password manager. Never a password.
      password_manager_ref  text NOT NULL DEFAULT '',
      active                boolean NOT NULL DEFAULT true,
      notes                 text NOT NULL DEFAULT '',
      created_at            timestamptz NOT NULL DEFAULT now(),
      updated_at            timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE sms_usage (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      month       text NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
      -- NULL = the whole account (when the split per salon is unknown).
      salon_id    uuid REFERENCES salons(id) ON DELETE CASCADE,
      sent        integer NOT NULL CHECK (sent >= 0),
      cost_bani   integer NOT NULL DEFAULT 0 CHECK (cost_bani >= 0),
      source      text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'twilio')),
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX sms_usage_month_salon ON sms_usage (month, coalesce(salon_id, '00000000-0000-0000-0000-000000000000'::uuid));

    CREATE TABLE backup_checks (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      kind        text NOT NULL CHECK (kind IN ('backup', 'restore_test')),
      checked_at  timestamptz NOT NULL DEFAULT now(),
      checked_by  uuid REFERENCES users(id) ON DELETE SET NULL,
      file_name   text NOT NULL DEFAULT '',
      note        text NOT NULL DEFAULT ''
    );
    CREATE INDEX backup_checks_idx ON backup_checks (kind, checked_at DESC);

    CREATE TRIGGER infra_services_updated_at BEFORE UPDATE ON infra_services FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
    CREATE TRIGGER sms_usage_updated_at BEFORE UPDATE ON sms_usage FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS backup_checks, sms_usage, infra_services');
}
