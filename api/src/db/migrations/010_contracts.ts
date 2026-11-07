import type { Knex } from 'knex';

/**
 * Phase 3, module 3: contracts and compliance. A salon's subscription contract, custom projects,
 * the DPA (GDPR data processing agreement) and addenda, with their dates. Files can be attached to
 * a contract or a salon. "DPA signed" = a signed contract of kind 'dpa'.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE contracts (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      salon_id    uuid NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
      -- Who signed (the salon's client at the time).
      client_id   uuid REFERENCES clients(id) ON DELETE SET NULL,
      kind        text NOT NULL DEFAULT 'subscription' CHECK (kind IN ('subscription', 'custom_project', 'dpa', 'addendum')),
      number      text NOT NULL DEFAULT '',
      status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'expired', 'terminated')),
      signed_on   date,
      starts_on   date,
      ends_on     date,
      renewal_on  date,
      auto_renew  boolean NOT NULL DEFAULT false,
      notes       text NOT NULL DEFAULT '',
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now(),
      CHECK (status NOT IN ('signed', 'expired', 'terminated') OR signed_on IS NOT NULL),
      CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
    );
    CREATE INDEX contracts_salon_idx ON contracts (salon_id);
    CREATE INDEX contracts_renewal_idx ON contracts (renewal_on);
    CREATE UNIQUE INDEX contracts_number_idx ON contracts (number) WHERE number <> '';

    ALTER TABLE files
      ADD COLUMN salon_id uuid REFERENCES salons(id) ON DELETE SET NULL,
      ADD COLUMN contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL;
    CREATE INDEX files_salon_idx ON files (salon_id);
    CREATE INDEX files_contract_idx ON files (contract_id);

    CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE files DROP COLUMN IF EXISTS contract_id, DROP COLUMN IF EXISTS salon_id;
    DROP TABLE IF EXISTS contracts;
  `);
}
