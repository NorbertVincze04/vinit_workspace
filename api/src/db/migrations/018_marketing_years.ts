import type { Knex } from 'knex';

/**
 * Marketing per plan year, like the roadmap: each year has its own strategy (objectives, audience,
 * positioning, channel mix, budget, 12-month plan) and its own content. Year N covers plan months
 * 12(N-1)+1 … 12N from the "plan.start" setting.
 *
 * The strategy saved so far (the "marketing.strategy" setting) becomes Year 1's; existing content
 * belongs to Year 1. A year without a row (Year 1 before it is first edited) shows the business plan.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE marketing_years (
      year        integer PRIMARY KEY CHECK (year BETWEEN 1 AND 50),
      strategy    jsonb,
      updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE TRIGGER marketing_years_updated_at BEFORE UPDATE ON marketing_years FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

    INSERT INTO marketing_years (year, strategy, updated_by)
      SELECT 1, value, updated_by FROM app_settings WHERE key = 'marketing.strategy';
    DELETE FROM app_settings WHERE key = 'marketing.strategy';

    ALTER TABLE mkt_posts ADD COLUMN year integer NOT NULL DEFAULT 1 CHECK (year BETWEEN 1 AND 50);
    CREATE INDEX mkt_posts_year_idx ON mkt_posts (year, month);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    INSERT INTO app_settings (key, value, updated_by)
      SELECT 'marketing.strategy', strategy, updated_by FROM marketing_years WHERE year = 1 AND strategy IS NOT NULL
      ON CONFLICT (key) DO NOTHING;
    DELETE FROM mkt_posts WHERE year > 1;
    DROP INDEX mkt_posts_year_idx;
    ALTER TABLE mkt_posts DROP COLUMN year;
    DROP TABLE marketing_years;
  `);
}
