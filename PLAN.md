# VINIT Workspace: Salon Platform Plan (Phase 0)

> Status: **Phases 1–4 done (2026-11-08). All planned phases are built; waiting for your OK / next priorities.** Decisions are in §0; questions settled with the defaults are marked in §9.

## 0. Decisions (2026-11-07)

| # | Decision |
|---|---|
| 1 | **Client = the person or company that pays. One client has exactly one salon** (`salons.client_id UNIQUE`). No CUI or Reg. Com.; a **business address** is required |
| 2 | The Clients page becomes the people/companies list; current records migrate as in §4 |
| 3 | **Trial = Early Bird**: 3 free months for the first 50 salons. The **5 beta salons don't count** toward the 50 (separate `beta` promotion) |
| 4 | Included sessions are **counted per meeting** (one `included_session` time entry = one session) |
| 5 | The **48h clock starts when the client's materials are received** (`onboardings.materials_received_at`), not at signature |
| 6 | Files are stored **in Postgres** (`file_blobs`) |
| 7 | **Runs on your own machine with Docker.** No Vercel, Railway or other paid hosting. `docker compose up` starts DB + API + web; other devices on your Wi-Fi open `http://<pc-ip>:8080`. Stop it when you don't need it |
| 8 | Work **straight on `main`**, commit after each module, **never push** |
| A–G | Accepted defaults (2026-11-07): convert a lead from any stage, then it follows the salon · included sessions one-time per contract · billable time in exact minutes · marking a payment paid adds a Finances income entry · live paying-salon counter and roadmap steps in the database · retention = 1 − churned ÷ paying at period start · infra costs taken from Finances recurring payments |

---

## 1. What the folder says about the business

Sources: `Business Plan.docx` / `Vincze Norbert_Plan de afaceri_Sustenabil.pdf`, `Pitch.docx`, `Fișă onboarding (A4).pdf`,
`Cold Message.docx`, `cold call.txt`, `short cold message.txt`, `Clients.xlsm`, `resources/`, plus the two code repos.

| Topic | What it says |
|---|---|
| Company | **VINIT SaaS Solutions SRL**, Cluj-Napoca, CAEN 6201 (+6202, 6311). Remote-first. Share capital 1,000 RON. Slogan *"Brandul tău. Aplicația ta. Fără limite."* Site: vinit.vincze-norbert.com, then vinit.ro |
| Product | White-label booking PWA per salon (own domain, logo and colours, no competitors shown). Three portals: Client / Employee / Owner. VINIT staff hold the Admin role and configure site content |
| Plans | Standard Barbershop **150 RON/mo** · Premium Brand **200 RON/mo** (adds SMS/WhatsApp reminders via Twilio, auto-waitlist, digital punch-card, private client notes) · Custom **from 1,000 RON** one-off, or a subscription of at least 4 months. Flat price, no per-barber fees |
| Included work | 2 × 30-min sessions (Standard/Premium), 3 × 30-min (Custom). Structural changes, redesign after approval and new features cost **100 RON/h** |
| Onboarding | 4 steps, **under 48h**: 30-min kickoff → VINIT configures → 30-min prototype approval → launch. The salon sends logo and colours, services (durations and prices), opening hours and barbers, photos and the domain it wants |
| Market | ~500 independent barbershops in big cities, ~2,500 nationally. Competitors: Mero, Stailer, Booksy, Vagaro, Fresha. Persona: barbershop owner aged 20–35, Instagram-heavy |
| Year-1 goals | 5 free beta salons by month 3 · 50 paying salons / **7,500 RON MRR** by month 12 · retention **≥ 70%** · onboarding < 48h |
| Mid term (yr 3–5) | ~500 salons, > 75,000 RON MRR, 10 cities, 4 staff, 3 add-ons (card deposits, stock, advanced reports) aiming at +20% ARPU |
| Costs | Initial 24,585 RON. Monthly **6,380 RON** (2,600 operational + 3,780 salaries). Includes Vercel 100, Railway 100, Twilio 300 (≈1,500 SMS at 0.20 RON), accounting 500, lawyer 500, ads 500 |
| Break-even | **43 salons** on Standard (43 × 150 = 6,450 RON) |
| Funding | Target 20,000 EUR (~100,000 RON): **Start-Up Nation 2026** first, Innovation Labs in parallel |
| Promotion | **Early Bird: 3 months free for the first 50 salons.** Mix: 40% direct sales (IG DM, email, visits), 30% social, 20% ads, 10% PR. Month-10 referral offer: *"bring a salon, get 3 months free"* |
| Team | Founder (dev, ops, support) + Marketing & Sales specialist (base salary + bonus per activated salon) |
| Sustainability | 3D-printed PLA keychains and QR stands for partner salons (`resources/3D models`), paperless booking, green multi-tenant hosting |
| Brand | Teal `#0E9899`, blue `#35398C`, orange `#F49739`, purple `#61398C`, greys `#B2B2B2` / `#989999` |
| Leads | `Clients.xlsm` (has macros) holds ~20 real prospects (Satu Mare, Cluj, Pitești, Buzău, Iași, Constanța, Eforie Nord, Timișoara) with columns Business Name, Email, Phone, Employees, Service, Billing, Notes, Status, Website, Location, Social media. This maps directly onto the new Leads module |

### Inconsistencies in the documents

1. **Break-even:** the pitch script says *"with only 10 salons we reach break-even"*. The plan and the app say **43**. The 10 matches the "lean" ~1,500 RON/month figure in §3.2 of the plan. The KPIs below use 43, as you specified.
2. **Delivery time:** §1.4 of the plan says *"under 24 hours"*. Everywhere else, including the onboarding sheet, says **48h**. The plan below uses 48h.
3. **Offers:** the plan has Early Bird (3 months free, first 50 salons). The cold messages offer **50% off** plus a free test group. The month-10 marketing plan has a referral offer of 3 months free. The data model has to record which offer each salon got (see `promotions`).
4. The onboarding sheet still contains `[EMAIL]` and `[TELEFON]` placeholders.
5. The SMS budget of 1,500/month total works out to ~75 SMS per salon with 20 Premium salons. That's tight, so module 11 alerts on it.
6. `vinit_workpage/Business Plan.docx` is **untracked** and identical to the copy in the parent folder.

---

## 2. What exists today

### `vinit_workpage` (this repo, remote `github.com/NorbertVincze04/vinit_workspace`, branch `main`)

- **Angular 18.2**, standalone components, **signals**, OnPush, new control flow (`@if`/`@for`), lazy `loadComponent` routes, zone.js. No NgRx and no HttpClient yet.
- **No backend.** All data lives in `localStorage` (`vinit.*` keys) through `StorageService` → `persistedSignal()` / `persistedCollection()`. File bytes are in IndexedDB (`FileStorageService`, 50 MB per file). Each tool has an export/import JSON backup (`Backupable`: `snapshot()` + `importState()`).
- **Modules:** Overview (dashboard), Tasks (goals plus 788-line seed), Clients, Finances (transactions, recurring, holdings, accounts, budgets, EUR/USD rates), Marketing (12-month calendar), Roadmap (4 phases, steps with stable ids `b1…`, plus a manual "paying salons" counter), Files.
- **Business numbers** are hard-coded in `core/data/finance.data.ts` (`BREAK_EVEN_SALONS = 43`, `YEAR1_MRR = 7500`). Plan month 1 = `2026-12` (`PlanCalendarService`).
- **Today's `Client` is really a salon:** `{ salon, owner, city, phone, email, domain, plan, price (RON float), status: lead|demo|beta|active|paused, since, notes }`. MRR = sum of prices of Active clients.
- **UI kit** (`shared/ui`): page-header, panel, ledger and ledger-row (CSS subgrid, phone layout), form-dialog driven by `FieldDef[]`, confirm-dialog, tabs, chip-group, segmented, status-pill, meter, progress-bar, kpi-card, bar-chart, month-switcher, empty-state, toast, menu, icons. Tokens are in `styles/tokens.css` with dark mode.
- **Tests:** only `app.component.spec.ts` (Karma/Jasmine).

### `template_driven_app` (the salon product; reference only, I won't change it)

- Express 5 + TS (`tsx`), raw `pg`, controllers → services → repositories, numbered raw SQL migrations (`sql/001…025`), bcrypt, JWT, `express-rate-limit`, morgan, `node:test`. CI/CD lives in GitHub Actions.
- Tenants are `shops (id uuid, slug, config jsonb, is_active)` plus `shop_domains (domain, is_primary)`. The site config JSON is in `shops.config`, with `public/tenants/default.json` as a fallback.
- **Link to the internal app:** `salons.tenant_slug` = `shops.slug`. There's no cross-database access. A `TenantPlatformProvider` stub (Phase 4) can read deploy and config status later.

### Conventions I'll follow

- Frontend: the "Adding a tool" recipe in README.md. Feature folders are `features/tools/<name>/` with `*-page.component`, `*.store.ts`, `*.model.ts`, `*.fields.ts` and `components/`. Every page starts with `app-page-header` plus one primary action. Panels, the ledger, form-dialog, confirm-dialog and toasts are reused, and colours come only from tokens. Stores keep the same public signal API, so pages don't change when storage moves to the API.
- Backend: mirrors the product repo (Express 5, controller/service/repository layering, `httpError`, rate-limited auth, morgan, `.env` via dotenv) so both codebases feel the same.
- New sidebar entries go through `core/data/tools.data.ts`.

---

## 3. Architecture decisions (recommendations)

| Decision | Recommendation | Why |
|---|---|---|
| Repo layout | Keep Angular at the repo root (nothing moves). Add `api/` (Express) and `docker-compose.yml` (db, api, web). zod schemas live in `api/` for now and move to a shared `contracts/` folder once the frontend needs the same enums (Phase 2) | Doesn't break the existing app |
| Hosting | **Local only (decision 7).** `db` = postgres:16 (host port 5433, data in a named Docker volume). `api` = Node 22 running the API. `web` = nginx serving the Angular build and proxying `/api` to the API, on port 8080 for your PC and phones on the same Wi-Fi. `npm run db:backup` writes `pg_dump` files to `backups/` | Free, data stays on your PC |
| Migrations / DB access | **Knex** (migrations, seeds, query builder) with typed row interfaces per repository | SQL-first. We need CHECK constraints, partial unique indexes, triggers, `tsvector` and views, which Prisma pushes into raw SQL anyway. Matches the product's raw `pg` repository style. Lighter than Prisma on Railway |
| Validation | **zod** schemas in `contracts/`, used by the API on every body and query. The frontend keeps `FieldDef` validation, extended with `maxLength`, `pattern` and custom `validate` | Same rules on both sides from one source |
| Auth | bcrypt (cost 12, `bcryptjs`, so there's no native build). JWT in an **httpOnly, SameSite=Lax cookie**, same-origin because nginx (or the `ng serve` proxy) forwards `/api`, so there's no CORS. The `Secure` flag is off by default because the LAN uses plain http (`COOKIE_SECURE=true` once HTTPS is in front). An `X-Requested-With` header is required on writes, and login is rate-limited. No public sign-up: users are created by a CLI script, max 3 enforced. `token_version` per user to log out all sessions | Simple and safe for 3 users on a home network |
| Money | `integer` columns suffixed `_bani` (max ≈ 21.4M RON), plus `currency char(3)` where it isn't always RON. Formatting via the existing `ron` pipe (bani → RON) | No float errors |
| Dates and timezone | Instants are `timestamptz` (UTC). Calendar days are `date`. "Today" = `(now() AT TIME ZONE 'Europe/Bucharest')::date`. The pg `DATE` type parser returns strings, so there's no JS timezone shift | Correct due dates around midnight and DST |
| IDs | `uuid` via `gen_random_uuid()` (like the product). Tickets also get a readable number (`T-0042`) | |
| Files | `files` metadata plus a `FileStore` interface. v1 stores bytes in Postgres (`file_blobs`, ≤ 50 MB) so they're backed up with the DB. It can be swapped for S3/R2 later (see Q9) | Smallest setup for 3 users |
| IDs (Phase 1 tables) | The tables of the existing tools use **`text` ids** (default `gen_random_uuid()::text`) so old backups and the local-data import keep their ids and links (`tlx3k9a2f1q`, `g1`…). New Phase 2+ tables use `uuid` | Old backups still import |
| Jobs | `node-cron` inside the API, daily at 07:00 Europe/Bucharest, plus a refresh on startup and on demand, since the PC isn't always on. Generates notifications and deadline entries idempotently (`dedupe_key`) | No extra service |
| Tests | API: **Vitest + supertest** against the real Postgres in Docker (separate `vinit_test` database). Frontend: Karma specs for new stores and pure helpers | |
| Secrets | Only env vars for API keys. The DB never stores passwords. `password_manager_ref` fields hold a label and a link to the vault entry | As requested |

---

## 4. Client ↔ Salon (needs your confirmation)

**Proposal:** **client** = the person or company that signs and pays (name, CUI, contact, billing email). **salon** = one
tenant/site (domain, plan, status, config). **One client → many salons.** A **lead** is a prospect before conversion and lives
in its own table; "Convert" creates (or picks an existing) client plus a new salon, and links all three.

How the current `Client` records migrate (one-time import from this browser):

| Old status | Becomes |
|---|---|
| `lead` | `lead` (stage `contacted`) — no client/salon yet |
| `demo` | `lead` (stage `demo_booked`) |
| `beta` | client + salon (`trial`) + subscription (`trialing`, price 0, promotion = beta) |
| `active` | client + salon (`active`) + subscription (`active`, price × 100 → bani, start = `since`) |
| `paused` | client + salon (`paused`) + subscription (`paused`) |

The **Clients page** then becomes a list of people and companies, each showing their salons. The pipeline view moves to
**Leads** and **Salons**. This changes an existing module's UI, so I need your OK (Q2).

---

## 5. PostgreSQL schema

Conventions: every table has `id uuid PK default gen_random_uuid()`, `created_at` / `updated_at timestamptz not null default now()`
(an `updated_at` trigger), and enums are `text + CHECK` (easier to change than PG enums). FK = foreign key; ↳ = index.

### 5.1 Platform

```sql
users            (email citext UNIQUE, full_name, password_hash, role text CHECK (role IN ('owner','member')),
                  is_active bool, token_version int default 0, last_login_at timestamptz)
app_settings     (key text PK, value jsonb, updated_by FK users)
                 -- 'plan.start', 'targets' {breakEvenSalons:43, year1Mrr_bani:750000, year1Salons:50, retentionPct:70,
                 --  onboardingHours:48, earlyBirdLimit:50, smsMonthlyBudget:1500}, 'finance.rates', 'finance.assumptions'
activity_log     (occurred_at, user_id FK, entity_type, entity_id uuid, salon_id FK NULL, action, summary, data jsonb)
                 ↳ (salon_id, occurred_at DESC), (occurred_at DESC), (entity_type, entity_id)
notifications    (user_id FK, kind, title, body, entity_type, entity_id, salon_id FK NULL, due_on date,
                  dedupe_key text, read_at, dismissed_at)  UNIQUE (user_id, dedupe_key)  ↳ (user_id, read_at)
```

### 5.2 Existing modules (moved to the API without changing their UI)

```sql
goals            (name, target, position)
tasks            (text, goal_id FK NULL ON DELETE SET NULL, owner text, prio text, due_month int CHECK 1..12,
                  phase text, done bool, notes, position)                         ↳ (phase), (goal_id)
fin_accounts     (name, kind, currency char(3), balance_bani int, as_of date, notes)
fin_transactions (type, description, amount_bani int, currency, date, category, scope, account_id FK NULL,
                  holding_id FK NULL, recurring_id FK NULL, payment_id FK NULL → payments, reference, notes)
                                                                                 ↳ (date DESC), (category)
fin_recurring    (type, name, amount_bani, currency, frequency, next_date, category, scope, account_id FK, active, notes)
fin_holdings     (name, kind, platform, opening_bani, current_value_bani, currency, value_date, notes)
fin_budgets      (category UNIQUE, limit_bani)
mkt_posts        (title, month int, week int, date NULL, format, mix, platforms text[], count int, budget_bani,
                  status, caption, visual, cta, keywords, hashtags, notes)      ↳ (month)
roadmap_steps    (id text PK  -- 'b1','p1'… same ids as today, phase, text, position, milestone bool)
roadmap_progress (step_id FK PK, done_at, done_by FK users)
files            (name, mime, size_bytes, kind, storage_key, uploaded_by FK,
                  salon_id FK NULL, contract_id FK NULL, ticket_id FK NULL, wiki_page_id FK NULL)
                 ↳ (salon_id), (contract_id)
file_blobs       (file_id FK PK ON DELETE CASCADE, bytes bytea)
```
The roadmap's manual "paying salons" counter becomes a live count of active salons (Q8).

### 5.3 Core — Phase 2

```sql
clients          (kind CHECK ('person','company'), name, company_name, contact_person, email, phone,
                  business_address NOT NULL, city, billing_email, notes)        ↳ trigram(name, company_name)
plans            (code UNIQUE CHECK ('standard','premium','custom'), name, monthly_price_bani, one_off_from_bani,
                  included_sessions int, session_minutes int default 30, includes_sms bool, min_term_months int,
                  extra_hourly_bani default 10000, is_active)
                 -- seed: standard 15000/2 sessions; premium 20000/2/sms; custom one_off_from 100000, 3 sessions, min 4 months
promotions       (code UNIQUE  -- 'early_bird','beta','referral','discount_50', name, free_months int NULL,
                  discount_pct int NULL, max_salons int NULL  -- early_bird = 50, valid_from, valid_to, notes)

salons           (client_id FK NOT NULL UNIQUE  -- one salon per client (decision 1), name, tenant_slug UNIQUE  -- = product shops.slug, city,
                  status CHECK ('lead','trial','active','paused','churned'), plan_id FK,
                  config_version text, config_url text, config_updated_at, 
                  deploy_status CHECK ('not_deployed','building','live','failed'), deployed_at,
                  signed_at timestamptz NULL, go_live_on date NULL, churned_on date NULL, churn_reason,
                  lead_id FK NULL UNIQUE, referred_by_salon_id FK NULL, uptime_monitor_id text NULL, notes)
                 ↳ (client_id), (status), trigram(name)
salon_domains    (salon_id FK, domain UNIQUE CHECK lower/no scheme, is_primary, registrar, expires_on date,
                  auto_renew bool, dns_status CHECK ('pending','configured','verified','error'),
                  ssl_status CHECK ('pending','active','expiring','error'), ssl_expires_on, password_manager_ref)
                 UNIQUE (salon_id) WHERE is_primary   ↳ (expires_on)
salon_status_history (salon_id FK, from_status, to_status, changed_on date, changed_by FK, reason)
                 ↳ (salon_id, changed_on)   -- basis for churn and retention

leads            (business_name, contact_name, phone, email, instagram, website, city, employees int, services,
                  source CHECK ('instagram_dm','visit','email','referral','phone','facebook','event','other'),
                  source_detail, stage CHECK ('contacted','replied','demo_booked','trial','paying','lost'),
                  stage_position int, next_follow_up_on date, demo_at timestamptz,
                  lost_reason CHECK ('price','no_reply','happy_with_current','not_ready','closed','other') NULL,
                  lost_note, owner_user_id FK, interested_plan_id FK NULL, referred_by_salon_id FK NULL,
                  converted_client_id FK NULL, converted_salon_id FK NULL, converted_at, notes)
                 CHECK (stage <> 'lost' OR lost_reason IS NOT NULL)
                 ↳ (stage, stage_position), (next_follow_up_on), trigram(business_name)
lead_activities  (lead_id FK CASCADE, user_id FK, kind CHECK ('note','dm','call','email','visit','stage_change'),
                  body, from_stage, to_stage, occurred_at)                        ↳ (lead_id, occurred_at DESC)

subscriptions    (salon_id FK, plan_id FK, price_bani int  -- actual monthly price, billing_cycle CHECK
                  ('monthly','quarterly','yearly','one_off'), status CHECK ('trialing','active','past_due',
                  'paused','canceled','ended'), started_on date, trial_ends_on date NULL, min_term_ends_on date NULL,
                  promotion_id FK NULL, canceled_on, cancel_reason, notes)
                 UNIQUE (salon_id) WHERE status IN ('trialing','active','past_due','paused')  -- one live sub per salon
                 ↳ (status), (trial_ends_on)
subscription_changes (subscription_id FK, changed_on date, kind CHECK ('upgrade','downgrade','price_change',
                  'pause','resume','cancel','trial_converted'), from_plan_id, to_plan_id,
                  from_price_bani, to_price_bani, note, changed_by FK)
payments         (subscription_id FK NULL, salon_id FK, kind CHECK ('subscription','one_off','extra_work'),
                  period_start date NULL, period_end date NULL, amount_bani int CHECK (>= 0), due_on date,
                  paid_on date NULL, status CHECK ('due','paid','void','waived'), method, invoice_number,
                  invoice_provider CHECK ('smartbill','oblio') NULL, invoice_external_id, invoice_status, notes)
                 ↳ (salon_id, due_on), (status, due_on)
                 -- "overdue" is derived: status='due' AND due_on < today (Bucharest)

onboarding_template_items (position, title, description, category, wiki_page_id FK NULL)
                 -- seed: collect logo · colours · services & prices · staff & hours · photos · domain ·
                 --       kickoff session · write JSON config · connect domain (DNS + SSL) · prototype approval ·
                 --       test booking · handover
onboardings      (salon_id FK UNIQUE, signed_at timestamptz NOT NULL, materials_received_at timestamptz NULL,
                  target_live_at timestamptz GENERATED (materials_received_at + interval '48 hours'),
                  went_live_at NULL,   -- 48h clock starts at materials_received_at (decision 5)
                  status CHECK ('in_progress','blocked','done'), blocked_reason, notes)
onboarding_steps (onboarding_id FK CASCADE, position, title, category, done_at, done_by FK, note)

tickets          (number serial UNIQUE, salon_id FK, title, description,
                  type CHECK ('bug','change_request','question'),
                  status CHECK ('open','in_progress','waiting_client','resolved','closed'),
                  priority CHECK ('low','normal','high','urgent'), reported_via, assignee_id FK NULL,
                  feature_request_id FK NULL, opened_at, resolved_at, closed_at)
                 ↳ (salon_id, status), (status, priority)
time_entries     (salon_id FK NOT NULL, ticket_id FK NULL, onboarding_id FK NULL, user_id FK, worked_on date,
                  minutes int CHECK (> 0), kind CHECK ('included_session','billable','internal'),
                  rate_bani int default 10000, description, billed_payment_id FK NULL → payments)
                 ↳ (salon_id, kind), (ticket_id)
```

Derived, not stored (SQL views or service functions):
- **MRR** = Σ monthly-normalised `price_bani` of subscriptions in `active` / `past_due` (quarterly ÷ 3, yearly ÷ 12; one-off excluded; trialing = 0). Historical MRR is rebuilt from `subscription_changes`.
- **Remaining included sessions** = `plans.included_sessions` − count(`included_session` entries for the salon).
- **Unbilled amount** = Σ round(`minutes` × `rate_bani` / 60) of billable entries with `billed_payment_id IS NULL`.
- **Onboarding duration** = `went_live_at − materials_received_at`. Flagged when it's over 48h, or when it's still open past `target_live_at`. Time from signature to materials is shown separately ("waiting on client").
- **Early Bird slots left** = 50 − salons whose subscription uses promotion `early_bird`. Beta salons use `beta` and don't count.

### 5.4 Supporting — Phase 3

```sql
kpi_snapshots    (month date PK, active_salons, trial_salons, mrr_bani, new_salons, churned_salons,
                  trial_to_paid_pct numeric, retention_pct numeric, avg_onboarding_hours numeric, pipeline jsonb)
                 -- written on the 1st of each month by the cron job, so trends survive later edits
feature_requests (title, description, status CHECK ('new','planned','in_progress','shipped','declined'),
                  roadmap_step_id FK NULL → roadmap_steps, shipped_on)
feature_votes    (feature_request_id FK CASCADE, salon_id FK NULL, lead_id FK NULL, note, voted_on)
                 CHECK (salon_id IS NOT NULL OR lead_id IS NOT NULL)
                 UNIQUE (feature_request_id, salon_id), UNIQUE (feature_request_id, lead_id)
                 -- vote count = count(*)
contracts        (salon_id FK, client_id FK, kind CHECK ('subscription','custom_project','dpa','addendum'),
                  number, status CHECK ('draft','sent','signed','expired','terminated'),
                  signed_on, starts_on, ends_on, renewal_on, auto_renew, notes)   ↳ (salon_id), (renewal_on)
                 -- "DPA signed (yes + date)" = a signed contract of kind 'dpa'. Files attach via files.contract_id.
                 -- Signing a 'subscription' contract sets salons.signed_at and creates the onboarding.
deadlines        (title, category CHECK ('domain_renewal','contract_renewal','trial_end','tax','accounting',
                  'funding','service_subscription','other'), due_on date, salon_id FK NULL,
                  recurrence CHECK ('none','monthly','quarterly','yearly'), remind_days int[] default '{14,3,0}',
                  source_type text NULL, source_id uuid NULL, status CHECK ('open','done','dismissed'), done_at,
                  url, notes)
                 UNIQUE (source_type, source_id, due_on)  ↳ (due_on)
                 -- auto-generated (idempotent upsert) from salon_domains.expires_on, contracts.renewal_on,
                 -- subscriptions.trial_ends_on, infra_services.renews_on. Manual ones: tax (D100, D112, D101…
                 -- to confirm with the accountant) and funding (Start-Up Nation 2026).
wiki_pages       (slug UNIQUE, title, category CHECK ('onboarding','deploy','json_schema','backups','sales','other'),
                  body_md, search tsvector  -- maintained by trigger with unaccent, archived bool, updated_by FK)
                 ↳ GIN(search)
wiki_revisions   (page_id FK CASCADE, revision int, title, body_md, edited_by FK, edited_at)
                 UNIQUE (page_id, revision)
infra_services   (name, vendor, category CHECK ('hosting','database','sms','domain','email','tooling','other'),
                  plan_name, monthly_cost_bani, currency, recurring_id FK NULL → fin_recurring, renews_on,
                  dashboard_url, status_url, password_manager_ref, notes)
sms_usage        (month date, salon_id FK NULL, sent int, cost_bani, source CHECK ('manual','twilio'))
                 UNIQUE (month, salon_id)
backup_checks    (service, checked_at, checked_by FK, restore_tested bool, notes)
```

### 5.5 Cross-cutting — Phase 4

- Extensions: `pgcrypto`, `citext`, `pg_trgm`, `unaccent`. Trigram GIN indexes on the name and title columns marked above, for global search.
- `activity_log` is written by the service layer **in the same transaction** as every create, update, status change and conversion. A salon's "full story" is its activity timeline plus key dates.
- Integration columns already exist in Phase 2 (`payments.invoice_*`, `salons.uptime_monitor_id`, `config_*`, `deploy_status`). Phase 4 only adds the provider interfaces.

**Built in Phase 4 (2026-11-08):** tools grouped by role in the sidebar and on the Overview (Sales & marketing, Salons &
support, Money, Planning, Operations); `GET /activity` + Activity page + Recent activity on the Overview; `notifications`
(migration 014) generated hourly per person, with a bell; `GET /search` + Ctrl+K search box; `api/src/integrations` with
the built-in uptime checker and stubs for SmartBill/Oblio, UptimeRobot and the booking platform (credentials only in `.env`).
Not done: invoices are not sent automatically (stub answers 501), uptime is checked on demand only (no schedule).

---

## 6. API (`/api/v1`, JSON, cookie auth on everything except login)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/password` |
| Settings | `GET/PUT /settings/:key` |
| Existing tools | `GET/POST /goals`, `PATCH/DELETE /goals/:id` · same pattern for `/tasks`, `/finances/{accounts,transactions,recurring,holdings,budgets}`, `/marketing/posts`, `/roadmap/steps` (+ `PUT /roadmap/progress/:stepId`), `/files` (`POST` multipart, `GET /files/:id/download`) · `GET/POST /backup/:tool` (export, or import the same JSON format the UI uses today) · `POST /import/local` (one-time localStorage migration) |
| Clients | `GET/POST /clients` · `GET/PATCH/DELETE /clients/:id` (delete is blocked while it still has salons) |
| Salons | `GET /salons?status=&q=` · `POST /salons` · `GET/PATCH /salons/:id` · `POST /salons/:id/status` (writes history) · `GET /salons/:id/overview` (aggregate for the detail page) · `GET /salons/:id/timeline` · `GET/POST /salons/:id/domains`, `PATCH/DELETE /domains/:id` |
| Leads | `GET /leads?stage=&q=&due=` · `POST /leads` · `PATCH/DELETE /leads/:id` · `POST /leads/:id/move` {stage, position, lostReason?} · `POST /leads/:id/activities` · `POST /leads/:id/convert` {clientId \| newClient, salon} → {client, salon} · `POST /leads/import` (CSV/XLSX rows, e.g. `Clients.xlsm`) |
| Plans / promos | `GET /plans` · `PATCH /plans/:id` · `GET/POST/PATCH /promotions` |
| Subscriptions | `GET /subscriptions?status=` · `POST /salons/:id/subscriptions` · `PATCH /subscriptions/:id` · `POST /subscriptions/:id/change` (upgrade, downgrade, pause, resume, cancel) · `GET /subscriptions/warnings` · `GET /metrics/mrr?from=&to=` |
| Payments | `GET /payments?status=&salonId=` · `POST /payments` · `PATCH /payments/:id` · `POST /payments/:id/mark-paid` (optionally creates a Finances income transaction) · `POST /payments/generate?month=` (due payments for active subs) |
| Onboarding | `GET /onboardings?open=true` · `POST /salons/:id/onboarding` {signedAt} · `PATCH /onboardings/:id` · `PATCH /onboarding-steps/:id` · `POST /onboardings/:id/go-live` · `GET/PUT /onboarding-template` |
| Tickets | `GET /tickets?salonId=&status=&type=` · `POST /tickets` · `GET/PATCH /tickets/:id` · `GET/POST /tickets/:id/time` · `PATCH/DELETE /time-entries/:id` · `GET /salons/:id/sessions` (included / used / remaining, unbilled) · `POST /salons/:id/bill-extra-work` (creates an `extra_work` payment and links the entries) |
| KPIs | `GET /kpis?month=` · `GET /kpis/history` |
| Feature requests | `GET/POST /feature-requests` · `PATCH/DELETE /feature-requests/:id` · `POST/DELETE /feature-requests/:id/votes` |
| Contracts | `GET /contracts?salonId=` · `POST /contracts` · `PATCH/DELETE /contracts/:id` · files via `/files?contractId=` |
| Deadlines | `GET /deadlines?from=&to=` (manual + generated) · `GET /deadlines/upcoming?days=30` · `POST /deadlines` · `PATCH/DELETE /deadlines/:id` · `POST /deadlines/regenerate` |
| Wiki | `GET /wiki?q=&category=` · `GET /wiki/:slug` · `POST /wiki` · `PUT /wiki/:slug` (adds a revision) · `GET /wiki/:slug/revisions` · `POST /wiki/:slug/restore/:rev` |
| Infra | `GET/POST/PATCH/DELETE /infra/services` · `GET/PUT /infra/sms-usage?month=` · `GET/POST /infra/backup-checks` · `GET /infra/health` |
| Cross-cutting | `GET /search?q=` (salons, clients, leads, tickets, wiki) · `GET /activity?salonId=&limit=` · `GET /notifications` · `POST /notifications/:id/read` · `POST /notifications/read-all` · `GET /integrations/status` |

Errors follow `{ error: { code, message, fields? } }` with status 400 (zod field errors), 401, 404 or 409 (e.g. a second live subscription).

---

## 7. Frontend plan

- **Data layer:** `core/api/api.service.ts` (HttpClient with `withCredentials`, an error interceptor that turns failures into toasts). `apiCollection<T>(resource)` has the same interface as `persistedCollection()` (signals plus optimistic add, update and remove), so existing stores switch storage with a one-line change and the pages stay as they are. The sidebar's "save status" turns into an API sync status.
- **Login page** plus an `authGuard` on every route.
- **New tools in `tools.data.ts`:** Salons, Leads, Subscriptions (with payments), Onboarding, Support, KPIs, Feature requests, Contracts, Calendar, Wiki, Infra.
- **Salon detail** `/tools/salons/:id` uses `app-tabs`: *Overview* (status, plan, domain/DNS/SSL, config, key dates, sessions left, unbilled, alerts) · *Subscription & payments* · *Onboarding* · *Tickets & time* · *Contracts & files* · *Feature requests* · *Timeline*.
- **Leads:** kanban with drag and drop (Angular CDK `DragDropModule`, the only new dependency; it handles touch on phones) plus a list view in the ledger. Phones get a horizontally scrolling board, or a stage picker instead of dragging.
- Overview dashboard gets: trials ending, overdue payments, follow-ups due today, onboardings over 48h.
- Every new list is responsive through the ledger's phone layout. The `ron` pipe takes bani.

---

## 8. Order of implementation (one commit per module, stop after each phase)

**Phase 1 — Backend foundation**
1. `api/` scaffold: Express 5 + TS, config/env, Knex, base migration (extensions, users, settings, activity_log), error handling, health check, Vitest + supertest harness, `docker-compose.yml`.
2. Auth: login/logout/me, cookie JWT, rate limit, `create-user` CLI (max 3), guard and login page in Angular.
3. Migrations and endpoints for the existing tools (tasks, finances, marketing, roadmap, files), with integer-bani conversion.
4. Angular `apiCollection()` plus switching each store over, one commit per tool. Backups keep working.
5. One-time "Move this browser's data to the server" import, seed script with demo data (fake data, not the real `Clients.xlsm` people), Docker images (api + nginx web), backup script, README.

**Clients stays in browser storage during Phase 1.** Its records are reshaped into clients + salons in Phase 2 (§4), so moving them twice would be wasted work.

**Phase 2 — Core:** Clients + Salons (and the clients migration) → Leads → Subscriptions & payments → Onboarding → Tickets & time.
**Phase 3 — Supporting:** KPI dashboard → Feature requests → Contracts → Deadlines calendar → Wiki → Infra.
**Phase 4 — Cross-cutting:** activity feed → notifications plus cron → global search → integration stubs (`InvoiceProvider` SmartBill/Oblio, `UptimeProvider`, `TenantPlatformProvider`).

Each module brings: migration, zod schemas, repository/service/controller, API tests (happy path, validation 400, auth 401, key business rule), store, page(s), FieldDefs and a README section.

---

## 9. Open questions (none block Phase 1)

Answered 2026-11-07, see §0: client/salon, Clients page, trial/Early Bird, session counting, 48h clock, file storage, Docker/local hosting, git.

✓ = settled with the default. Still open: H, I (documents; nothing to build).

| # | Question | Needed in | Default if you don't mind |
|---|---|---|---|
| A ✓ | **Lead conversion:** convert at "demo booked" or "trial"? Should the lead's stage then follow the salon (trial → `trial`, first paid payment → `paying`)? | Phase 2 (Leads) | Convert from any stage. The stage follows the salon |
| B ✓ | **Included sessions:** one-time per contract (kickoff + prototype approval) or renewing every period? | Phase 2 (Tickets) | One-time per contract |
| C ✓ | **Billable rounding:** exact minutes, or round up to 15-min blocks? | Phase 2 (Tickets) | Exact minutes |
| D ✓ | **Finances link:** create a Finances income transaction automatically when a payment is marked paid? | Phase 2 (Subscriptions) | Yes |
| E ✓ | **Retention ≥ 70%** = 1 − churned in period ÷ paying salons at period start (monthly and year-to-date)? | Phase 3 (KPIs) | Yes |
| F ✓ | **Roadmap:** move steps into the DB (same ids, same UI) so feature requests can link to them, and replace the manual "paying salons" counter with the live count of active salons? | Phase 2/3 | Yes. Until then the counter stays manual |
| G ✓ | **Infra costs:** take each service's monthly cost from a Finances recurring payment (one source of truth)? | Phase 3 (Infra) | Yes |
| H | **Documents:** fix the 10-vs-43 break-even and 24h-vs-48h wording in the pitch and plan, or leave them? | — | Leave them, the app uses 43 / 48h |
| I | Should `Business Plan.docx` (untracked, duplicate of the parent folder's copy) go into `.gitignore`? | — | Leave it untracked, never commit it |
