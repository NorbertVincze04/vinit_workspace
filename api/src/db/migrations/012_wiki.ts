import type { Knex } from 'knex';

/**
 * Phase 3, module 5: wiki / SOPs. Markdown pages with full-text search (diacritics ignored, so
 * "fisa" finds "Fișă") and every saved version kept in wiki_revisions (revision 1 = first save).
 * A few starter pages come from the business documents; edit or archive them freely.
 */
const ONBOARDING = `How a new salon goes live in under 48 hours. The clock starts when **all the client's materials** have arrived (see the Onboarding tool).

## 1. Collect the materials
- Logo (vector or high resolution) and brand colours
- Services with durations and prices
- Opening hours, barbers (name and photo)
- Photos of the salon
- The domain they want (check it is free, note who owns it)

## 2. Kickoff session (30 min, included session 1)
Walk through the materials and the owner's wishes. Log it in Support as an included session.

## 3. Configure
- Write the tenant JSON config in the booking product
- Connect the domain: DNS, then SSL

## 4. Prototype approval (30 min, included session 2)
The owner approves the site. Changes after approval are extra work (100 RON/h).

## 5. Launch
- Test booking end to end (book, confirmation, cancel)
- Owner portal access, QR stand, announce on Instagram
- Press **Go live** in the Onboarding tab`;

const PLANS = `## Plans
| Plan | Price | Included |
|---|---|---|
| Standard Barbershop | 150 RON / month | 2 × 30-min sessions |
| Premium Brand | 200 RON / month | SMS/WhatsApp reminders, waitlist, punch card, client notes, 2 sessions |
| Custom | from 1.000 RON one-off, or a subscription of at least 4 months | 3 sessions |

Extra work (structural changes, redesign after approval, new features): **100 RON/h**.

## Offers
- **Early Bird**: 3 months free for the first 50 salons (beta salons don't count).
- **Beta**: the 5 free beta salons.
- **Referral** (month 10): bring a salon, get 3 months free.

## Targets
- Break-even: 43 salons on Standard (monthly costs 6.380 RON)
- Year 1: 50 salons, 7.500 RON MRR, retention ≥ 70%`;

const BACKUPS = `The database (with every uploaded file) lives in the Docker volume \`vinit_pgdata\` on this PC.

## Back up
\`\`\`
npm run db:backup
\`\`\`
This writes \`backups/vinit-<date>.dump\`. **Copy it somewhere else** (external drive, cloud folder): a backup on the same disk doesn't survive a dead disk.

## Restore
\`\`\`
npm run db:restore -- backups/<file>.dump --yes
docker compose restart api
\`\`\`
This replaces everything. Test a restore now and then (record it in Infra › Backups).

## Passwords
Never store passwords in the workspace. Keep them in the password manager and only note *where* they are.`;

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE wiki_pages (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
      title       text NOT NULL CHECK (btrim(title) <> ''),
      category    text NOT NULL DEFAULT 'other' CHECK (category IN ('onboarding', 'deploy', 'json_schema', 'backups', 'sales', 'other')),
      body_md     text NOT NULL DEFAULT '',
      revision    integer NOT NULL DEFAULT 1,
      archived    boolean NOT NULL DEFAULT false,
      search      tsvector,
      updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX wiki_pages_search_idx ON wiki_pages USING gin (search);

    CREATE TABLE wiki_revisions (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      page_id    uuid NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
      revision   integer NOT NULL,
      title      text NOT NULL,
      body_md    text NOT NULL,
      edited_by  uuid REFERENCES users(id) ON DELETE SET NULL,
      edited_at  timestamptz NOT NULL DEFAULT now(),
      UNIQUE (page_id, revision)
    );

    CREATE FUNCTION wiki_search_update() RETURNS trigger AS $$
    BEGIN
      NEW.search := setweight(to_tsvector('simple', unaccent(coalesce(NEW.title, ''))), 'A')
                 || setweight(to_tsvector('simple', unaccent(coalesce(NEW.body_md, ''))), 'B');
      RETURN NEW;
    END $$ LANGUAGE plpgsql;
    CREATE TRIGGER wiki_pages_search BEFORE INSERT OR UPDATE OF title, body_md ON wiki_pages FOR EACH ROW EXECUTE FUNCTION wiki_search_update();
    CREATE TRIGGER wiki_pages_updated_at BEFORE UPDATE ON wiki_pages FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  `);

  const pages = [
    { slug: 'onboarding-in-48h', title: 'Onboarding a salon in 48 hours', category: 'onboarding', bodyMd: ONBOARDING },
    { slug: 'plans-prices-and-offers', title: 'Plans, prices and offers', category: 'sales', bodyMd: PLANS },
    { slug: 'backups-and-restore', title: 'Backups and restore', category: 'backups', bodyMd: BACKUPS },
  ];
  for (const p of pages) {
    const [row] = await knex('wiki_pages').insert({ slug: p.slug, title: p.title, category: p.category, body_md: p.bodyMd }).returning('id');
    await knex('wiki_revisions').insert({ page_id: row.id, revision: 1, title: p.title, body_md: p.bodyMd });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TABLE IF EXISTS wiki_revisions, wiki_pages;
    DROP FUNCTION IF EXISTS wiki_search_update();
  `);
}
