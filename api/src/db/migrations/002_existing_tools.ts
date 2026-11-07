import type { Knex } from 'knex';

/**
 * Tables for the tools that used to live in the browser: Tasks, Finances, Marketing, Roadmap, Files.
 *
 * - Ids are text (default: a uuid) so backups and the one-time browser import keep their ids
 *   ("g1", "tlx3k9a2f1q"…) and the links between records.
 * - Money is integer bani (1 RON = 100 bani), never floating point.
 * - Calendar days are `date`; an empty value in the old data becomes NULL.
 */
const ID = `text PRIMARY KEY DEFAULT gen_random_uuid()::text CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$')`;
const STAMPS = `created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()`;
const CURRENCY = `text NOT NULL DEFAULT 'RON' CHECK (currency IN ('RON', 'EUR', 'USD'))`;
const TX_TYPE = `text NOT NULL DEFAULT 'expense' CHECK (type IN ('income', 'expense', 'invest'))`;
const SCOPE = `text NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'business'))`;

const TABLES = [
  'goals',
  'tasks',
  'fin_accounts',
  'fin_holdings',
  'fin_recurring',
  'fin_transactions',
  'fin_budgets',
  'mkt_posts',
  'files',
];

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    -- Tasks ------------------------------------------------------------------
    CREATE TABLE goals (
      id        ${ID},
      name      text NOT NULL DEFAULT '',
      target    text NOT NULL DEFAULT '',
      position  integer NOT NULL DEFAULT 0,
      ${STAMPS}
    );

    CREATE TABLE tasks (
      id         ${ID},
      text       text NOT NULL DEFAULT '',
      goal_id    text REFERENCES goals(id) ON DELETE SET NULL,
      owner      text NOT NULL DEFAULT 'Unassigned'
                 CHECK (owner IN ('Founder', 'Marketing & Sales', 'Both', 'Unassigned')),
      prio       text NOT NULL DEFAULT 'Medium' CHECK (prio IN ('High', 'Medium', 'Low')),
      due_month  smallint NOT NULL DEFAULT 1 CHECK (due_month BETWEEN 1 AND 12),
      phase      text NOT NULL DEFAULT 'build' CHECK (phase IN ('build', 'prove', 'sell', 'scale')),
      done       boolean NOT NULL DEFAULT false,
      notes      text NOT NULL DEFAULT '',
      position   integer NOT NULL DEFAULT 0,
      ${STAMPS}
    );
    CREATE INDEX tasks_phase_idx ON tasks (phase);
    CREATE INDEX tasks_goal_idx ON tasks (goal_id);

    -- Finances ---------------------------------------------------------------
    CREATE TABLE fin_accounts (
      id            ${ID},
      name          text NOT NULL DEFAULT '',
      kind          text NOT NULL DEFAULT 'bank'
                    CHECK (kind IN ('bank', 'savings', 'cash', 'ewallet', 'card', 'loan')),
      currency      ${CURRENCY},
      balance_bani  integer NOT NULL DEFAULT 0,
      as_of         date,
      notes         text NOT NULL DEFAULT '',
      ${STAMPS}
    );

    CREATE TABLE fin_holdings (
      id                  ${ID},
      name                text NOT NULL DEFAULT '',
      kind                text NOT NULL DEFAULT '',
      platform            text NOT NULL DEFAULT '',
      opening_bani        integer NOT NULL DEFAULT 0,
      current_value_bani  integer NOT NULL DEFAULT 0,
      currency            ${CURRENCY},
      value_date          date,
      notes               text NOT NULL DEFAULT '',
      ${STAMPS}
    );

    CREATE TABLE fin_recurring (
      id           ${ID},
      type         ${TX_TYPE},
      name         text NOT NULL DEFAULT '',
      amount_bani  integer NOT NULL DEFAULT 0 CHECK (amount_bani >= 0),
      currency     ${CURRENCY},
      frequency    text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
      next_date    date,
      category     text NOT NULL DEFAULT '',
      scope        ${SCOPE},
      account_id   text REFERENCES fin_accounts(id) ON DELETE SET NULL,
      active       boolean NOT NULL DEFAULT true,
      notes        text NOT NULL DEFAULT '',
      ${STAMPS}
    );

    CREATE TABLE fin_transactions (
      id            ${ID},
      type          ${TX_TYPE},
      description   text NOT NULL DEFAULT '',
      amount_bani   integer NOT NULL DEFAULT 0 CHECK (amount_bani >= 0),
      currency      ${CURRENCY},
      date          date,
      category      text NOT NULL DEFAULT '',
      scope         ${SCOPE},
      account_id    text REFERENCES fin_accounts(id) ON DELETE SET NULL,
      holding_id    text REFERENCES fin_holdings(id) ON DELETE SET NULL,
      recurring_id  text REFERENCES fin_recurring(id) ON DELETE SET NULL,
      reference     text NOT NULL DEFAULT '',
      notes         text NOT NULL DEFAULT '',
      ${STAMPS}
    );
    CREATE INDEX fin_transactions_date_idx ON fin_transactions (date DESC);
    CREATE INDEX fin_transactions_account_idx ON fin_transactions (account_id);
    CREATE INDEX fin_transactions_holding_idx ON fin_transactions (holding_id);

    CREATE TABLE fin_budgets (
      id          ${ID},
      category    text NOT NULL DEFAULT '',
      limit_bani  integer NOT NULL DEFAULT 0 CHECK (limit_bani >= 0),
      ${STAMPS}
    );

    -- Marketing --------------------------------------------------------------
    CREATE TABLE mkt_posts (
      id           ${ID},
      title        text NOT NULL DEFAULT '',
      month        smallint NOT NULL DEFAULT 1 CHECK (month BETWEEN 1 AND 12),
      week         smallint NOT NULL DEFAULT 0 CHECK (week BETWEEN 0 AND 4),
      date         date,
      format       text NOT NULL DEFAULT '',
      mix          text NOT NULL DEFAULT '',
      platforms    text[] NOT NULL DEFAULT '{}',
      count        integer NOT NULL DEFAULT 1 CHECK (count >= 0),
      budget_bani  integer NOT NULL DEFAULT 0 CHECK (budget_bani >= 0),
      status       text NOT NULL DEFAULT 'planned'
                   CHECK (status IN ('planned', 'draft', 'ready', 'scheduled', 'published')),
      caption      text NOT NULL DEFAULT '',
      visual       text NOT NULL DEFAULT '',
      cta          text NOT NULL DEFAULT '',
      keywords     text NOT NULL DEFAULT '',
      hashtags     text NOT NULL DEFAULT '',
      notes        text NOT NULL DEFAULT '',
      ${STAMPS}
    );
    CREATE INDEX mkt_posts_month_idx ON mkt_posts (month);

    -- Roadmap: which checklist steps are done (step ids come from the app, e.g. "b1").
    CREATE TABLE roadmap_progress (
      step_id  text PRIMARY KEY CHECK (step_id ~ '^[A-Za-z0-9_-]{1,32}$'),
      done_at  timestamptz NOT NULL DEFAULT now(),
      done_by  uuid REFERENCES users(id) ON DELETE SET NULL
    );

    -- Files: metadata here, bytes in file_blobs (kept apart so listing files never loads them).
    CREATE TABLE files (
      id           ${ID},
      name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 255),
      mime         text NOT NULL DEFAULT '',
      size_bytes   integer NOT NULL CHECK (size_bytes > 0),
      kind         text NOT NULL DEFAULT 'other'
                   CHECK (kind IN ('pdf', 'slides', 'sheet', 'doc', 'image', 'other')),
      uploaded_by  uuid REFERENCES users(id) ON DELETE SET NULL,
      ${STAMPS}
    );
    CREATE TABLE file_blobs (
      file_id  text PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
      bytes    bytea NOT NULL
    );
  `);

  for (const table of TABLES) {
    await knex.raw(`CREATE TRIGGER ${table}_updated_at BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION touch_updated_at()`);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TABLE IF EXISTS file_blobs, files, roadmap_progress, mkt_posts, fin_budgets, fin_transactions,
      fin_recurring, fin_holdings, fin_accounts, tasks, goals;
  `);
}
