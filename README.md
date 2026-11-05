# VINIT Workspace

Internal workspace for **VINIT SaaS Solutions SRL** (not for public use): a launcher for the business tools,
live statistics from those tools, and a reference summary of the business plan for team members.
Angular 18 (standalone components, signals). All data is saved in the browser's `localStorage` (keys prefixed `vinit.`);
every tool has **Export backup / Import** to keep a copy or move data to another device.

```bash
npm start        # dev server on http://localhost:4200
npm run build    # production build in dist/
```

## Tools

| Tool | Route | What it does |
|---|---|---|
| Roadmap | `/tools/roadmap` | Four phase checklists, paying-salon counter vs. break-even |
| Tasks | `/tools/tasks` | Year 1 goals split into tasks, owners, due months, goals editor |
| Clients | `/tools/clients` | Salon pipeline (lead → active), MRR vs. monthly costs |
| Finances | `/tools/finances` | Transactions, recurring payments, investments, accounts, budgets, cash-flow chart, CSV export |
| Marketing plan | `/tools/marketing` | 12-month content calendar (Annex 3), communication mix vs. target, copy & hashtags |

The overview page (`/`) reads every tool's store for its **Current status** cards. "Month 1" of the plan is shared by all
tools (`PlanCalendarService`) and can be changed from Tasks or Marketing.

## Structure

```
src/
  styles/                 tokens.css (colours, fonts, spacing, chart & status colours), base.css, utilities.css
  app/
    core/                 no UI — data, models, services, helpers
      data/               business.data.ts (overview content), finance.data.ts (all plan numbers),
                          phases.data.ts (Build/Prove/Sell/Scale), tools.data.ts (tool registry + nav)
      models/             TypeScript interfaces (Entity = id/createdAt/updatedAt base)
      services/           StorageService, ThemeService, PlanCalendarService (shared Month 1), ToastService
      utils/              persistedSignal(), persistedCollection(), date/format/text helpers, file (JSON/CSV)
    shared/
      ui/                 primitives: button, card, badge, icon, checkbox, fields, grid, section, page-header,
                          dialog, confirm-dialog, form-dialog (+ FieldDef), ledger + ledger-row, chip-group,
                          tabs, segmented, status-pill, meter, month-switcher, inline-stats, empty-state, toast …
      components/         composites: kpi-card, bar-chart, backup-actions, plan-start-field, phase-card,
                          phase-rail, tool-card, feature-tile, progress-summary, save-status
      pipes/ directives/  `ron` pipe, `appAutosize` textarea directive
    layout/               header, footer
    features/
      home/               overview dashboard, one component per section (sections/)
      tools/<tool>/       <tool>-page.component, <tool>.store.ts, <tool>.model.ts, <tool>.data.ts,
                          <tool>.fields.ts (form definitions) and components/ used only by that tool
      not-found/
```

## Conventions

- **Reuse before you build.** Import primitives from `shared/ui` and composites from `shared/components`:
  ```html
  <app-card padding="lg" highlight>
    <app-badge variant="solid">New</app-badge>
    <button appButton variant="primary" type="button">Save</button>
  </app-card>
  ```
- **Forms are data.** Describe fields once (`FieldDef[]`) and render them with `<app-form-dialog>` — it handles
  layout, defaults, dependent fields, validation (required, numbers like `49,99`) and returns the values:
  ```ts
  export const CLIENT_FIELDS: FieldDef[] = [
    { key: 'salon', label: 'Salon name', type: 'text', required: true, span: 'full' },
    { key: 'price', label: 'Monthly price (RON)', type: 'number', default: 150 },
  ];
  ```
  ```html
  @if (form(); as f) {
    <app-form-dialog heading="New client" [fields]="fields" [initial]="f.values" (saved)="save($event)" (closed)="form.set(null)" />
  }
  ```
- **Lists use the ledger.** `<app-ledger [headers] columns="…">` + `<app-ledger-row>` give every tool the same
  bordered list, header row and phone layout. Cell helpers: `.cell-title`, `.cell-sub`, `.cell-num`, `.cell-actions`.
- Buttons are an attribute on native elements (`<button appButton>`, `<a appButton routerLink="…">`) so they keep
  their semantics.
- Presentational components take `input()` and emit `output()`; pages (and Finances' tab panels) read the store.
- Each tool keeps its state in a root `*Store` built on `persistedCollection()` / `persistedSignal()` — replace
  `StorageService` with an API later without touching the components.
- Colours come only from CSS variables in `styles/tokens.css` (main `#0E9899`, secondary `#35398C`), with dark mode.
  Chart colours (`--chart-1..3`) are validated for colour-blind separation in light and dark mode.

## Adding a tool

1. Create `features/tools/<name>/` with a page component and, if it saves data, a store using `persistedCollection()`.
2. Add a lazy route in `app.routes.ts`.
3. Add its entry in `core/data/tools.data.ts` with `status: 'live'` — header, footer and overview update automatically.
4. Optional: add a KPI for it in `features/home/sections/status/status-section.component.ts`.
