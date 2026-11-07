import type { Knex } from 'knex';

/**
 * Year plans: each plan year (Year 1 = the 12 months from the "plan.start" setting, Dec 2026 – Nov
 * 2027) has its business goals and its roadmap (phases with steps). Year 1 is filled with what the
 * app used until now: the business-plan targets and the Build / Prove / Sell / Scale roadmap, word
 * for word. Existing steps keep their ids (ticks and feature-request links stay).
 *
 * Goals are nullable: empty = not set for that year. Money in bani.
 */
const YEAR1_PHASES: [key: string, name: string, from: number, to: number, goal: string, milestone: string][] = [
  ['build', 'Build', 1, 3, 'Set up the company and ship a version you can show.', 'MVP is live and one salon runs on its own domain.'],
  ['prove', 'Prove', 4, 6, 'Get five salons using it for real.', '5 salons book weekly and 3 testimonials are in hand.'],
  ['sell', 'Sell', 7, 9, 'Turn demos and beta users into paying salons.', '20 paying salons by the end of Month 9.'],
  ['scale', 'Scale', 10, 12, 'Cross break-even and keep your customers.', '50 salons and 7.500 RON of monthly recurring income.'],
];

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE plan_years (
      year                    integer PRIMARY KEY CHECK (year BETWEEN 1 AND 50),
      -- Salons
      paying_salons           integer CHECK (paying_salons BETWEEN 0 AND 100000),
      break_even_salons       integer CHECK (break_even_salons BETWEEN 0 AND 100000),
      -- Money (bani)
      mrr_bani                bigint CHECK (mrr_bani >= 0),
      income_bani             bigint CHECK (income_bani >= 0),
      monthly_costs_bani      bigint CHECK (monthly_costs_bani >= 0),
      -- Quality
      retention_pct           integer CHECK (retention_pct BETWEEN 0 AND 100),
      onboarding_hours        integer CHECK (onboarding_hours BETWEEN 1 AND 2000),
      -- Operations
      sms_monthly_budget      integer CHECK (sms_monthly_budget BETWEEN 0 AND 10000000),
      operational_costs_bani  bigint CHECK (operational_costs_bani >= 0),
      notes                   text NOT NULL DEFAULT '',
      updated_by              uuid REFERENCES users(id) ON DELETE SET NULL,
      updated_at              timestamptz NOT NULL DEFAULT now()
    );
    CREATE TRIGGER plan_years_updated_at BEFORE UPDATE ON plan_years FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

    CREATE TABLE roadmap_phases (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      year        integer NOT NULL REFERENCES plan_years(year) ON DELETE CASCADE,
      -- build / prove / sell / scale for Year 1 (Tasks use these); null for phases you add.
      key         text,
      name        text NOT NULL CHECK (btrim(name) <> ''),
      month_from  integer NOT NULL CHECK (month_from BETWEEN 1 AND 12),
      month_to    integer NOT NULL CHECK (month_to BETWEEN 1 AND 12),
      goal        text NOT NULL DEFAULT '',
      milestone   text NOT NULL DEFAULT '',
      position    integer NOT NULL DEFAULT 0,
      CHECK (month_from <= month_to)
    );
    CREATE INDEX roadmap_phases_year_idx ON roadmap_phases (year, position);

    INSERT INTO plan_years (year, paying_salons, break_even_salons, mrr_bani, income_bani, monthly_costs_bani,
                            retention_pct, onboarding_hours, sms_monthly_budget, operational_costs_bani)
    VALUES (1, 50, 43, 750000, NULL, 638000, 70, 48, 1500, 260000);
  `);
  await knex('roadmap_phases').insert(
    YEAR1_PHASES.map(([key, name, monthFrom, monthTo, goal, milestone], position) => ({ year: 1, key, name, month_from: monthFrom, month_to: monthTo, goal, milestone, position })),
  );
  await knex.raw(`
    ALTER TABLE roadmap_steps ADD COLUMN phase_id uuid REFERENCES roadmap_phases(id) ON DELETE CASCADE;
    UPDATE roadmap_steps s SET phase_id = p.id FROM roadmap_phases p WHERE p.year = 1 AND p.key = s.phase;
    ALTER TABLE roadmap_steps ALTER COLUMN phase_id SET NOT NULL, DROP COLUMN phase,
      ADD CONSTRAINT roadmap_steps_text_check CHECK (btrim(text) <> '');
    CREATE INDEX roadmap_steps_phase_idx ON roadmap_steps (phase_id, position);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE roadmap_steps ADD COLUMN phase text;
    UPDATE roadmap_steps s SET phase = p.key FROM roadmap_phases p WHERE p.id = s.phase_id;
    DELETE FROM roadmap_steps WHERE phase IS NULL;
    ALTER TABLE roadmap_steps DROP CONSTRAINT roadmap_steps_text_check, DROP COLUMN phase_id,
      ALTER COLUMN phase SET NOT NULL, ADD CONSTRAINT roadmap_steps_phase_check CHECK (phase IN ('build', 'prove', 'sell', 'scale'));
    DROP TABLE roadmap_phases;
    DROP TABLE plan_years;
  `);
}
