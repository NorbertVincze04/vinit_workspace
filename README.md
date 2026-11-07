# VINIT Workspace

Internal workspace for **VINIT SaaS Solutions SRL** (not for public use): one place where the team opens the tools
they work with — tasks, clients, finances, marketing calendar, roadmap and shared files — plus an overview of what
needs attention. Angular 18 (standalone components, signals) + an Express/PostgreSQL API (`api/`), all running on
your own PC with Docker. Sign-in is required (max 3 team accounts). See [PLAN.md](PLAN.md) for the salon-platform roadmap.

## Run it (Docker, on your PC)

First time:

```bash
cp .env.example .env            # then fill DB_PASSWORD and JWT_SECRET (random, see the file)
docker compose up -d --build    # database + API + web app
docker compose exec api node --import tsx src/scripts/create-user.ts --email you@vinit.ro --name "Your Name"
```

Open **http://localhost:8080** and sign in. From a phone on the same Wi-Fi, open **http://&lt;your-PC-IP&gt;:8080**
(find the IP with `ipconfig`; allow port 8080 if Windows Firewall asks).

Every day: `docker compose up -d` to start, `docker compose stop` to stop. Data lives in the Docker volume `vinit_pgdata`
and survives restarts and rebuilds. After pulling code changes: `docker compose up -d --build` (migrations run on start).

| Task | Command |
|---|---|
| Add a team member (max 3) | `docker compose exec api node --import tsx src/scripts/create-user.ts --email … --name "…"` |
| Reset a password | `docker compose exec api node --import tsx src/scripts/set-password.ts --email …` |
| Back up the database | `npm run db:backup` → `backups/vinit-<date>.dump` (includes uploaded files; copy it somewhere safe) |
| Restore a backup | `npm run db:restore -- backups/<file>.dump --yes` (replaces everything), then `docker compose restart api` |
| Try with demo data | `npm --prefix api run db:seed:demo` → database `vinit_demo` (never the real `vinit` database): finances, marketing, and fake salons, leads, subscriptions, an onboarding and tickets. Run the API with `DB_NAME=vinit_demo` and add a login there with `user:create` |

**Moving your old browser data:** before the server existed, everything was saved in the browser. Open the Overview in
the browser that has your latest data and click **Move to the server** (one time). Tasks, Finances, Marketing,
Roadmap, settings and files are copied; nothing in the browser is deleted. Records from the old browser **Clients** tool
have their own **Move clients to the server** button (Overview and Salons): leads and demos become Leads; beta, active
and paused become a salon with its client and subscription. Then add each client's business address (Clients › Address
missing), since the old list had none.

Security notes: the app is served over plain http on your home network, so only use it on networks you trust. The
database port is only reachable from the PC itself. Passwords are bcrypt-hashed; sessions are httpOnly cookies.

## Develop

```bash
docker compose up -d db          # only the database (127.0.0.1:5433)
cp api/.env.example api/.env     # once: same DB_PASSWORD as .env, any JWT_SECRET ≥ 32 chars
npm --prefix api install         # once
npm run api                      # API on http://localhost:3000 (reloads on change)
npm start                        # app on http://localhost:4200, /api is proxied to the API
```

Create a user for development with `npm --prefix api run user:create -- --email … --name "…"`.

| Command | What it does |
|---|---|
| `npm test` | Angular unit tests (Karma) |
| `npm run api:test` | API tests (Vitest + supertest) against the separate `vinit_test` database — the db container must run |
| `npm --prefix api run typecheck` | Type-check the API |
| `npm --prefix api run db:migrate` / `db:rollback` | Apply / undo migrations (`api/src/db/migrations`, listed in `index.ts`) |

### API

`/api/v1`, JSON, cookie session; every write needs the `X-Requested-With` header (the app adds it).
Errors: `{ "error": { "code", "message", "fields"? } }`. Money is **integer bani** (`amountBani: 4999` = 49,99 RON);
the Angular stores convert at the boundary (`core/api/api-fields.ts`), so the app's models keep RON.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/password` |
| Tools | `GET/POST /goals`, `/tasks`, `/finances/{accounts,holdings,recurring,transactions,budgets}`, `/marketing/posts`; `PATCH/DELETE …/:id`; `PUT …` replaces all (backup import) |
| Roadmap | `GET /roadmap`, `PUT /roadmap/steps/:stepId`, `PUT /roadmap` |
| Settings | `GET /settings`, `PUT /settings/:key` (`plan.start`, `finances.rates`, `roadmap.salons`) |
| Files | `GET /files`, `POST /files` (multipart, ≤ 50 MB), `GET /files/:id/download`, `DELETE /files/:id` |
| Clients | `GET/POST /clients`, `GET/PATCH/DELETE /clients/:id` (delete is refused while the client has a salon) |
| Salons | `GET /salons?status=&q=`, `POST /salons` (with `clientId` or a new `client`), `GET/PATCH/DELETE /salons/:id`, `POST /salons/:id/status` (writes the history), `GET /salons/:id/overview`, `GET /salons/:id/timeline`, `GET/POST /salons/:id/domains`, `PATCH/DELETE /domains/:id` |
| Leads | `GET /leads?stage=&q=&due=`, `POST /leads`, `GET/PATCH/DELETE /leads/:id`, `POST /leads/:id/move` {stage, position, lostReason}, `POST /leads/:id/activities`, `POST /leads/:id/convert` → {lead, salon}, `POST /leads/import` {rows} |
| Subscriptions | `POST /salons/:id/subscriptions`, `GET /subscriptions?status=`, `GET/PATCH /subscriptions/:id`, `POST /subscriptions/:id/change` {kind: upgrade, downgrade, price_change, pause, resume, cancel, trial_converted, past_due, end}, `GET /subscriptions/warnings`, `GET /metrics/mrr?from=&to=` |
| Payments | `GET /payments?status=&salonId=`, `POST /payments`, `PATCH/DELETE /payments/:id`, `POST /payments/:id/mark-paid` (adds the income to Finances), `POST /payments/:id/reopen`, `POST /payments/generate` {month} |
| Onboarding | `POST /salons/:id/onboarding`, `GET /onboardings?open=`, `GET/PATCH/DELETE /onboardings/:id`, `POST /onboardings/:id/steps`, `POST /onboardings/:id/go-live`, `PATCH/DELETE /onboarding-steps/:id`, `GET/PUT /onboarding-template` |
| Support | `GET/POST /tickets`, `GET/PATCH/DELETE /tickets/:id`, `GET/POST /time-entries`, `PATCH/DELETE /time-entries/:id`, `GET /salons/:id/sessions`, `POST /salons/:id/bill-extra-work` |
| Team | `GET /users` (names for pickers) |
| KPIs | `GET /kpis?month=` (+ targets), `GET /kpis/history?from=&to=`, `PUT /kpis/snapshots/:month` (recompute a closed month) |
| Feature requests | `GET/POST /feature-requests?status=`, `GET/PATCH/DELETE /feature-requests/:id`, `POST /feature-requests/:id/votes` {salonId | leadId}, `DELETE /feature-votes/:id`, `POST /tickets/:id/to-feature-request`, `GET /roadmap-steps` |
| Contracts | `GET/POST /contracts?salonId=&status=&kind=`, `GET/PATCH/DELETE /contracts/:id`, `GET /contracts/compliance`; files: `POST /files` with `salonId` / `contractId`, `GET /files?salonId=&contractId=` |
| Deadlines | `GET /deadlines?from=&to=&status=&salonId=`, `GET /deadlines/upcoming?days=`, `POST /deadlines`, `PATCH/DELETE /deadlines/:id`, `POST /deadlines/:id/done`, `POST /deadlines/regenerate` |
| Import | `POST /import/legacy-clients` {records} (old browser Clients list → leads / salons; skips records moved before) |
| Plans, promotions | `GET /plans`, `PATCH /plans/:id`, `GET/POST /promotions`, `PATCH /promotions/:id` (seeded by the migrations) |

## Tools

| Tool | Route | What it does |
|---|---|---|
| Overview | `/` | Tool launcher, live figures from every tool, salons needing attention (overdue payments, trials ending, onboardings over 48h, urgent tickets, lead follow-ups due), tasks due now, payments due in 14 days |
| KPIs | `/tools/kpis` | Any month vs. the plan: paying salons (43 break-even, 50 goal), MRR (7.500 RON goal), retention month and year (≥ 70%), trial → paid, onboarding hours (48h), new/churned, leads; 12-month charts and table. Closed months are frozen snapshots |
| Tasks | `/tools/tasks` | Year 1 goals split into tasks, owners, due months, goals editor |
| Leads | `/tools/leads` | Sales pipeline: board (drag cards between stages) or list, contact log with follow-ups, CSV import (e.g. the prospect list saved as CSV), convert into client + salon |
| Salons | `/tools/salons` | Every salon (tenant) with client, plan, status and domains; `/tools/salons/:id` is its whole story (overview, status history, timeline) |
| Onboarding | `/tools/onboarding` | Salons being set up: checklist from a template, the 48h clock from when the client's materials arrive, blocked reasons, go-live; average time to live |
| Subscriptions | `/tools/subscriptions` | MRR (now and month by month), who pays what, Early Bird places, payments to collect (create the month's in one click, mark paid → Finances income), warnings: trials ending, overdue, past due, salons without a subscription |
| Support | `/tools/support` | Tickets (T-0001…) by priority and status, time logged on them; the salon page shows included sessions left (counted per meeting), unbilled extra work (100 RON/h, exact minutes) and a "Bill extra work" button |
| Feature requests | `/tools/features` | What salons and leads ask for, ranked by the MRR of the paying salons that asked, then votes; linked to a roadmap step; shipping it notes it in each salon's story; change-request tickets become requests in one click |
| Contracts | `/tools/contracts` | Subscription contracts, DPAs (GDPR), custom projects, addenda (numbered VIN-2026-001…) with their files; missing paperwork per salon; signing the subscription contract starts the onboarding. The salon page has a Contracts & files tab |
| Calendar | `/tools/calendar` | Deadlines: month grid (agenda on phones) and upcoming list; manual ones repeat monthly/quarterly/yearly; domain, SSL, contract renewal, trial and minimum-term dates are generated from the salons |
| Clients | `/tools/clients` | The people and companies that pay (one salon each), with business address |
| Finances | `/tools/finances` | Transactions, recurring payments, investments, accounts, budgets, cash-flow chart, CSV export |
| Marketing | `/tools/marketing` | 12-month content calendar, communication mix vs. target, copy & hashtags |
| Roadmap | `/tools/roadmap` | Four phase checklists, live paying salons and MRR vs. break-even |
| Files | `/tools/files` | Upload shared documents (PDF, PowerPoint, Excel, Word, images…), filter, download, delete |

Files are stored in PostgreSQL (metadata in `files`, bytes in `file_blobs`), up to 50 MB per file.
`/tools/appendices` redirects to `/tools/files`.

"Month 1" of the plan is shared by all tools (`PlanCalendarService`) and can be changed from Tasks or Marketing.

## Structure

```
src/
  styles/                 tokens.css (colours, type, radii, layout, chart & status colours, dark mode),
                          base.css (element defaults), utilities.css (.toolbar, .input, .sr-only …)
  app/
    app.component         shell: sidebar (drawer on small screens), routed page, toasts
    layout/sidebar/       navigation built from the tools registry, theme switch, save status
    core/                 no UI — data, models, services, helpers
      api/                ApiService (ordered write queue, save status), apiCollection(), remoteSetting(),
                          field maps (api-fields.ts), interceptor (app header, expired session)
      auth/               AuthService (signed-in user), authGuard / guestGuard
      data/               tools.data.ts (tool registry → sidebar + overview), finance.data.ts (plan numbers),
                          phases.data.ts (Build/Prove/Sell/Scale)
      models/             TypeScript interfaces (Entity = id/createdAt/updatedAt base)
      services/           StorageService (per-device prefs), ThemeService, ToastService,
                          PlanCalendarService (shared Month 1), LocalDataService (one-time move of old browser data)
      utils/              persistedSignal(), persistedCollection(), date/format/text helpers, file (JSON/CSV)
    shared/
      ui/                 primitives: button, card, panel, badge, icon, checkbox, fields, grid, page-header,
                          menu + menu-item, dialog, confirm-dialog, form-dialog (+ FieldDef), ledger + ledger-row,
                          chip-group, tabs, segmented, status-pill, meter, progress-bar, month-switcher,
                          inline-stats, empty-state, toast …
      components/         composites: backup-menu, kpi-card, bar-chart, phase-card, plan-start-field,
                          progress-summary
      pipes/ directives/  `ron` pipe, `appAutosize` textarea directive
    features/
      login/              sign-in page
      dashboard/          overview page + components/ (status-grid, tool-tile, due-tasks, due-payments, local-data-banner)
      tools/salons/detail the salon page (one tab per module: overview, onboarding, billing, support, timeline)
      tools/<tool>/       <tool>-page.component, <tool>.store.ts, <tool>.model.ts, <tool>.data.ts,
                          <tool>.fields.ts (form definitions) and components/ used only by that tool
      not-found/
api/                      Express 5 + Knex + PostgreSQL (see "Develop" above)
  src/config.ts           env settings          src/app.ts        routes (public: health, auth; the rest needs a session)
  src/db/                 knex (camelCase ⇄ snake_case), migrations/ (raw SQL, listed in index.ts)
  src/lib/                resource.ts (generic CRUD + bulk replace + activity log), schemas.ts (zod field types)
  src/modules/            auth (+ users), tools (table definitions), settings, roadmap, files,
                          salons (clients, salons, domains, plans, promotions, old-clients import), leads,
                          billing (subscriptions, payments, MRR, warnings), onboarding, support (tickets, time)
  src/scripts/            migrate, create-user, set-password, seed-demo, backup/restore
  tests/                  Vitest + supertest
docker-compose.yml        db (Postgres 16) + api + web (nginx serving the build, proxying /api)
```

## Conventions

- **Reuse before you build.** Import primitives from `shared/ui` and composites from `shared/components`.
- **Every page starts the same way:**
  ```html
  <app-page-header title="Clients" description="Salon pipeline from first contact to paying customer.">
    <div pageActions>
      <app-backup-menu [store]="store" name="clients" />
      <button appButton variant="primary" type="button" (click)="openNew()">New client</button>
    </div>
  </app-page-header>
  ```
  One primary action per page; secondary actions (backups, reset, settings) go in the **⋯** menu.
  `<app-backup-menu>` handles export, import (with a confirmation before data is replaced) and toasts for any store
  that implements `Backupable` (`snapshot()` + `importState()`); extra `<button appMenuItem>` items can be projected.
- **Blocks of a page use `<app-panel heading="…">`** (titled card with an optional `panelAction` link/button).
- **Forms are data.** Describe fields once (`FieldDef[]`) and render them with `<app-form-dialog>` — it handles
  layout, defaults, dependent fields, validation (required, numbers like `49,99`) and returns the values:
  ```ts
  export const CLIENT_FIELDS: FieldDef[] = [
    { key: 'salon', label: 'Salon name', type: 'text', required: true, span: 'full' },
    { key: 'price', label: 'Monthly price (RON)', type: 'number', default: 150 },
  ];
  ```
- **Lists use the ledger.** `<app-ledger [headers] columns="…">` + `<app-ledger-row>` give every tool the same
  bordered list, header row and phone layout. Rows share the ledger's columns through CSS subgrid, so headers always
  line up. Cell helpers: `.cell-title`, `.cell-sub`, `.cell-num`, `.cell-actions`.
- **Destructive actions confirm** with `<app-confirm-dialog>`; results are reported with `ToastService`.
- Buttons are an attribute on native elements (`<button appButton>`, `<a appButton routerLink="…">`) so they keep
  their semantics.
- Presentational components take `input()` and emit `output()`; pages (and Finances' tab panels) read the store.
- Each tool keeps its state in a root `*Store` built on `apiCollection()` / `remoteSetting()` (server) — same shape as
  the older `persistedCollection()` / `persistedSignal()` (browser), so components never know where data lives.
  Changes show instantly and are written in order; a failed write shows a toast and reloads from the server.
- **Validate on both sides:** `FieldDef` rules in the form, zod schemas in the API (`api/src/lib/schemas.ts`), and
  CHECK constraints in the database.
- Colours, type and spacing come only from CSS variables in `styles/tokens.css` (accent `--main`, logo teal `#0E9899`,
  secondary `#35398C`), with dark mode. Chart colours (`--chart-1..3`) are validated for colour-blind separation.

## Adding a tool

1. API: add a migration (`api/src/db/migrations`, then list it in `index.ts`), a `ResourceDef` (fields as zod schemas)
   mounted in `app.ts`, and tests in `api/tests`.
2. Create `features/tools/<name>/` with a page component and a store using `apiCollection(path, FIELD_MAP)`
   (add `snapshot()` / `importState()` to get the backup menu for free).
3. Add a lazy route inside the signed-in group in `app.routes.ts`.
4. Add its entry in `core/data/tools.data.ts` — the sidebar and the overview launcher update automatically.
5. Optional: add a figure for it in `features/dashboard/components/status-grid/status-grid.component.ts`.
