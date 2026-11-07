import type { Knex } from 'knex';

/**
 * Phase 2, module 3: subscriptions, their change history (basis for MRR over time) and payments.
 *
 * - One live subscription per salon (trialing / active / past_due / paused).
 * - Every change, including the start, is a row in subscription_changes with the state after it,
 *   so MRR for any past month can be rebuilt.
 * - A paid payment can create a Finances income entry (fin_transactions.payment_id links them).
 */
const ID = `uuid PRIMARY KEY DEFAULT gen_random_uuid()`;
const STAMPS = `created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()`;
const STATUS = `('trialing', 'active', 'past_due', 'paused', 'canceled', 'ended')`;

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE subscriptions (
      id               ${ID},
      salon_id         uuid NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
      plan_id          uuid NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
      -- What the salon pays per billing period, after any discount (one_off: the whole price).
      price_bani       integer NOT NULL CHECK (price_bani >= 0),
      billing_cycle    text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly', 'one_off')),
      status           text NOT NULL CHECK (status IN ${STATUS}),
      started_on       date NOT NULL,
      trial_ends_on    date,
      min_term_ends_on date,
      promotion_id     uuid REFERENCES promotions(id) ON DELETE RESTRICT,
      canceled_on      date,
      cancel_reason    text NOT NULL DEFAULT '',
      notes            text NOT NULL DEFAULT '',
      ${STAMPS},
      CHECK (trial_ends_on IS NULL OR trial_ends_on >= started_on)
    );
    CREATE UNIQUE INDEX subscriptions_one_live ON subscriptions (salon_id)
      WHERE status IN ('trialing', 'active', 'past_due', 'paused');
    CREATE INDEX subscriptions_status_idx ON subscriptions (status);
    CREATE INDEX subscriptions_trial_idx ON subscriptions (trial_ends_on);

    CREATE TABLE subscription_changes (
      id               ${ID},
      subscription_id  uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      changed_on       date NOT NULL,
      kind             text NOT NULL CHECK (kind IN ('start', 'upgrade', 'downgrade', 'price_change', 'pause', 'resume',
                                                     'cancel', 'trial_converted', 'past_due', 'end')),
      from_plan_id     uuid REFERENCES plans(id) ON DELETE SET NULL,
      to_plan_id       uuid REFERENCES plans(id) ON DELETE SET NULL,
      from_price_bani  integer,
      to_price_bani    integer,
      from_status      text,
      to_status        text NOT NULL,
      -- Billing cycle after the change (MRR depends on it).
      billing_cycle    text NOT NULL,
      note             text NOT NULL DEFAULT '',
      changed_by       uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at       timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX subscription_changes_sub_idx ON subscription_changes (subscription_id, changed_on);

    CREATE TABLE payments (
      id                   ${ID},
      subscription_id      uuid REFERENCES subscriptions(id) ON DELETE RESTRICT,
      salon_id             uuid NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
      kind                 text NOT NULL DEFAULT 'subscription' CHECK (kind IN ('subscription', 'one_off', 'extra_work')),
      period_start         date,
      period_end           date,
      amount_bani          integer NOT NULL CHECK (amount_bani >= 0),
      due_on               date NOT NULL,
      paid_on              date,
      status               text NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'paid', 'void', 'waived')),
      method               text NOT NULL DEFAULT '',
      invoice_number       text NOT NULL DEFAULT '',
      invoice_provider     text CHECK (invoice_provider IN ('smartbill', 'oblio')),
      invoice_external_id  text NOT NULL DEFAULT '',
      invoice_status       text NOT NULL DEFAULT '',
      notes                text NOT NULL DEFAULT '',
      ${STAMPS},
      CHECK (status <> 'paid' OR paid_on IS NOT NULL),
      CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start)
    );
    -- Generating the month's payments twice never creates duplicates.
    CREATE UNIQUE INDEX payments_one_per_period ON payments (subscription_id, period_start) WHERE kind = 'subscription';
    CREATE INDEX payments_salon_idx ON payments (salon_id, due_on);
    CREATE INDEX payments_status_idx ON payments (status, due_on);

    ALTER TABLE fin_transactions ADD COLUMN payment_id uuid REFERENCES payments(id) ON DELETE SET NULL;
    CREATE UNIQUE INDEX fin_transactions_payment_idx ON fin_transactions (payment_id) WHERE payment_id IS NOT NULL;

    CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
    CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE fin_transactions DROP COLUMN IF EXISTS payment_id;
    DROP TABLE IF EXISTS payments, subscription_changes, subscriptions;
  `);
}
