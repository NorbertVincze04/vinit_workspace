import type { Knex } from 'knex';

/**
 * Phase 2, module 1: the central SALON entity and who pays for it.
 *
 * - client = the person or company that pays. One client has at most one salon (salons.client_id UNIQUE).
 * - salon  = one tenant / booking site (domain, plan, status, JSON config).
 * - plans and promotions are reference data, inserted here so every database (Docker, tests, demo)
 *   has them without a separate seed step.
 *
 * New tables use uuid ids. Avoid "?" in this SQL: Knex treats it as a binding placeholder.
 */
const ID = `uuid PRIMARY KEY DEFAULT gen_random_uuid()`;
const STAMPS = `created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()`;
const TODAY = `((now() AT TIME ZONE 'Europe/Bucharest')::date)`;

const TABLES = ['plans', 'promotions', 'clients', 'salons', 'salon_domains'];

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE plans (
      id                  ${ID},
      code                text NOT NULL UNIQUE CHECK (code IN ('standard', 'premium', 'custom')),
      name                text NOT NULL,
      monthly_price_bani  integer NOT NULL DEFAULT 0 CHECK (monthly_price_bani >= 0),
      one_off_from_bani   integer CHECK (one_off_from_bani >= 0),
      included_sessions   smallint NOT NULL DEFAULT 2 CHECK (included_sessions >= 0),
      session_minutes     smallint NOT NULL DEFAULT 30 CHECK (session_minutes > 0),
      includes_sms        boolean NOT NULL DEFAULT false,
      min_term_months     smallint NOT NULL DEFAULT 0 CHECK (min_term_months >= 0),
      extra_hourly_bani   integer NOT NULL DEFAULT 10000 CHECK (extra_hourly_bani >= 0),
      is_active           boolean NOT NULL DEFAULT true,
      ${STAMPS}
    );

    CREATE TABLE promotions (
      id           ${ID},
      code         text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_]{2,40}$'),
      name         text NOT NULL,
      free_months  smallint CHECK (free_months BETWEEN 0 AND 36),
      discount_pct smallint CHECK (discount_pct BETWEEN 1 AND 100),
      max_salons   integer CHECK (max_salons > 0),
      valid_from   date,
      valid_to     date,
      is_active    boolean NOT NULL DEFAULT true,
      notes        text NOT NULL DEFAULT '',
      ${STAMPS},
      CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
    );

    CREATE TABLE clients (
      id                ${ID},
      kind              text NOT NULL DEFAULT 'company' CHECK (kind IN ('person', 'company')),
      -- The payer: the person's or the company's name.
      name              text NOT NULL CHECK (btrim(name) <> ''),
      contact_person    text NOT NULL DEFAULT '',
      email             text NOT NULL DEFAULT '',
      phone             text NOT NULL DEFAULT '',
      -- Required for every new or edited client (enforced by the API). NULL only for records moved
      -- from the old browser Clients tool, which never asked for it; the app flags them.
      business_address  text CHECK (business_address IS NULL OR btrim(business_address) <> ''),
      city              text NOT NULL DEFAULT '',
      billing_email     text NOT NULL DEFAULT '',
      notes             text NOT NULL DEFAULT '',
      ${STAMPS}
    );
    CREATE INDEX clients_name_trgm ON clients USING gin (name gin_trgm_ops);

    CREATE TABLE salons (
      id                    ${ID},
      client_id             uuid NOT NULL UNIQUE REFERENCES clients(id) ON DELETE RESTRICT,
      name                  text NOT NULL CHECK (btrim(name) <> ''),
      -- = shops.slug in the booking product (no cross-database link).
      tenant_slug           text UNIQUE CHECK (tenant_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(tenant_slug) <= 63),
      city                  text NOT NULL DEFAULT '',
      status                text NOT NULL DEFAULT 'lead'
                            CHECK (status IN ('lead', 'trial', 'active', 'paused', 'churned')),
      plan_id               uuid REFERENCES plans(id) ON DELETE RESTRICT,
      config_version        text NOT NULL DEFAULT '',
      config_url            text NOT NULL DEFAULT '',
      config_updated_at     timestamptz,
      deploy_status         text NOT NULL DEFAULT 'not_deployed'
                            CHECK (deploy_status IN ('not_deployed', 'building', 'live', 'failed')),
      deployed_at           timestamptz,
      signed_at             timestamptz,
      go_live_on            date,
      churned_on            date,
      churn_reason          text NOT NULL DEFAULT '',
      lead_id               uuid UNIQUE,  -- FK added with the leads table
      referred_by_salon_id  uuid REFERENCES salons(id) ON DELETE SET NULL CHECK (referred_by_salon_id <> id),
      uptime_monitor_id     text NOT NULL DEFAULT '',
      notes                 text NOT NULL DEFAULT '',
      ${STAMPS}
    );
    CREATE INDEX salons_status_idx ON salons (status);
    CREATE INDEX salons_name_trgm ON salons USING gin (name gin_trgm_ops);

    CREATE TABLE salon_domains (
      id                    ${ID},
      salon_id              uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      domain                text NOT NULL UNIQUE
                            CHECK (domain ~ '^[a-z0-9-]+([.][a-z0-9-]+)+$' AND domain !~ '(^-|-[.]|[.]-|-$)'),
      is_primary            boolean NOT NULL DEFAULT false,
      registrar             text NOT NULL DEFAULT '',
      expires_on            date,
      auto_renew            boolean NOT NULL DEFAULT true,
      dns_status            text NOT NULL DEFAULT 'pending'
                            CHECK (dns_status IN ('pending', 'configured', 'verified', 'error')),
      ssl_status            text NOT NULL DEFAULT 'pending'
                            CHECK (ssl_status IN ('pending', 'active', 'expiring', 'error')),
      ssl_expires_on        date,
      -- Label or link of the password-manager entry. Never a password.
      password_manager_ref  text NOT NULL DEFAULT '',
      notes                 text NOT NULL DEFAULT '',
      ${STAMPS}
    );
    CREATE UNIQUE INDEX salon_domains_one_primary ON salon_domains (salon_id) WHERE is_primary;
    CREATE INDEX salon_domains_expires_idx ON salon_domains (expires_on);

    -- Basis for churn and retention figures.
    CREATE TABLE salon_status_history (
      id           ${ID},
      salon_id     uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
      from_status  text,
      to_status    text NOT NULL,
      changed_on   date NOT NULL DEFAULT ${TODAY},
      changed_by   uuid REFERENCES users(id) ON DELETE SET NULL,
      reason       text NOT NULL DEFAULT '',
      created_at   timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX salon_status_history_salon_idx ON salon_status_history (salon_id, changed_on);

    -- A salon's full story is its activity: link the log to salons now that they exist.
    UPDATE activity_log SET salon_id = NULL WHERE salon_id IS NOT NULL;
    ALTER TABLE activity_log
      ADD CONSTRAINT activity_log_salon_fk FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE SET NULL;

    -- Reference data from the business plan.
    INSERT INTO plans (code, name, monthly_price_bani, one_off_from_bani, included_sessions, includes_sms, min_term_months) VALUES
      ('standard', 'Standard Barbershop', 15000, NULL, 2, false, 0),
      ('premium', 'Premium Brand', 20000, NULL, 2, true, 0),
      ('custom', 'Custom', 0, 100000, 3, false, 4);

    INSERT INTO promotions (code, name, free_months, discount_pct, max_salons, notes) VALUES
      ('early_bird', 'Early Bird', 3, NULL, 50, 'First 50 salons: 3 months free. Beta salons do not count.'),
      ('beta', 'Beta (free)', NULL, 100, 5, 'The 5 free beta salons of months 1–3.'),
      ('referral', 'Referral', 3, NULL, NULL, 'Bring a salon, get 3 months free (month-10 offer).'),
      ('discount_50', '50% off', NULL, 50, NULL, 'Offer used in the cold messages.');
  `);

  for (const table of TABLES) {
    await knex.raw(`CREATE TRIGGER ${table}_updated_at BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION touch_updated_at()`);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_salon_fk;
    DROP TABLE IF EXISTS salon_status_history, salon_domains, salons, clients, promotions, plans;
  `);
}
