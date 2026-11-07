import type { Knex } from 'knex';

/**
 * Phase 3, module 2: feature requests with votes from salons and leads.
 *
 * Decision F: the roadmap steps move into the database (same ids as the app's checklist, b1…c5) so
 * a request can point at the step that delivers it. The Roadmap page keeps its own copy of the
 * texts; ids are what links them, and they never change.
 */
const ID = `uuid PRIMARY KEY DEFAULT gen_random_uuid()`;
const STAMPS = `created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()`;
const TODAY = `((now() AT TIME ZONE 'Europe/Bucharest')::date)`;

const STEPS: [string, string, string][] = [
  ['b1', 'build', 'Finish the multi-tenant app and the JSON template for new salons'],
  ['b2', 'build', 'Write a one-page onboarding sheet that lists every feature'],
  ['b3', 'build', 'Register the SRL and cover GDPR basics'],
  ['b4', 'build', 'List 30 barbershops in Cluj-Napoca to approach'],
  ['b5', 'build', 'Start posting on Instagram and announce Early Bird (3 months free)'],
  ['b6', 'build', 'Prepare the Start-Up Nation 2026 and Innovation Labs applications'],
  ['p1', 'prove', 'Onboard 5 beta salons in Cluj, each live in under 48 hours'],
  ['p2', 'prove', 'Ship SMS reminders and the waitlist (Twilio)'],
  ['p3', 'prove', 'Hold a feedback call with each beta salon after two weeks'],
  ['p4', 'prove', 'Turn feedback into 3 testimonials and short Reels'],
  ['p5', 'prove', 'Fix the top 5 issues the beta salons report'],
  ['p6', 'prove', 'Launch the Premium Brand upgrade offer'],
  ['s1', 'sell', 'Switch on the paid Standard and Premium packages'],
  ['s2', 'sell', 'Run Instagram, TikTok and Facebook ads (500 RON a month)'],
  ['s3', 'sell', 'Sponsor or attend a local barbering course'],
  ['s4', 'sell', 'Send outreach to larger salons (3+ chairs) outside Cluj'],
  ['s5', 'sell', 'Keep every new salon’s setup under 48 hours'],
  ['c1', 'scale', 'Launch the referral offer: bring a salon, get 3 months free'],
  ['c2', 'scale', 'Publish a year in review with hours saved by automations'],
  ['c3', 'scale', 'Check in with every salon to keep retention at 70% or more'],
  ['c4', 'scale', 'Reach 43 salons (break-even), then 50'],
  ['c5', 'scale', 'Plan next year’s add-ons: online payments, stock, reports'],
];

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE roadmap_steps (
      id        text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{1,64}$'),
      phase     text NOT NULL CHECK (phase IN ('build', 'prove', 'sell', 'scale')),
      text      text NOT NULL,
      position  integer NOT NULL DEFAULT 0
    );

    CREATE TABLE feature_requests (
      id               ${ID},
      title            text NOT NULL CHECK (btrim(title) <> ''),
      description      text NOT NULL DEFAULT '',
      status           text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'planned', 'in_progress', 'shipped', 'declined')),
      roadmap_step_id  text REFERENCES roadmap_steps(id) ON DELETE SET NULL,
      shipped_on       date,
      created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
      ${STAMPS},
      CHECK (status <> 'shipped' OR shipped_on IS NOT NULL)
    );
    CREATE INDEX feature_requests_status_idx ON feature_requests (status);
    CREATE INDEX feature_requests_title_trgm ON feature_requests USING gin (title gin_trgm_ops);

    -- One vote per salon or lead and request; the count is count(*).
    CREATE TABLE feature_votes (
      id                  ${ID},
      feature_request_id  uuid NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
      salon_id            uuid REFERENCES salons(id) ON DELETE CASCADE,
      lead_id             uuid REFERENCES leads(id) ON DELETE CASCADE,
      note                text NOT NULL DEFAULT '',
      voted_on            date NOT NULL DEFAULT ${TODAY},
      created_at          timestamptz NOT NULL DEFAULT now(),
      CHECK ((salon_id IS NULL) <> (lead_id IS NULL))
    );
    CREATE UNIQUE INDEX feature_votes_salon ON feature_votes (feature_request_id, salon_id) WHERE salon_id IS NOT NULL;
    CREATE UNIQUE INDEX feature_votes_lead ON feature_votes (feature_request_id, lead_id) WHERE lead_id IS NOT NULL;

    ALTER TABLE tickets ADD COLUMN feature_request_id uuid REFERENCES feature_requests(id) ON DELETE SET NULL;

    CREATE TRIGGER feature_requests_updated_at BEFORE UPDATE ON feature_requests FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  `);
  await knex('roadmap_steps').insert(STEPS.map(([id, phase, text], position) => ({ id, phase, text, position })));
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE tickets DROP COLUMN IF EXISTS feature_request_id;
    DROP TABLE IF EXISTS feature_votes, feature_requests, roadmap_steps;
  `);
}
