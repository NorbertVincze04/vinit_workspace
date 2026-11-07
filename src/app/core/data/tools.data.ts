import { NavLink, ToolDefinition, ToolGroup } from '../models';

/**
 * Workspace tools registry: the single source for the sidebar and the overview launcher.
 * Tools are grouped by what they are for, so each role finds its tools together:
 * the Marketing & Sales specialist mostly lives in "Sales & marketing", the founder in
 * "Salons & support" and "Operations", both share "Money" and "Planning".
 * To add a tool: create its page under features/tools, add a route in app.routes.ts, then add it here.
 */
export const TOOL_GROUPS: readonly ToolGroup[] = [
  {
    id: 'sales',
    title: 'Sales & marketing',
    who: 'Finding and winning salons',
    tools: [
      {
        id: 'leads',
        title: 'Leads',
        description: 'Sales pipeline board: contacted, demo, trial, paying.',
        icon: 'target',
        route: '/tools/leads',
      },
      {
        id: 'marketing',
        title: 'Marketing',
        description: '12-month content calendar with copy and platforms.',
        icon: 'megaphone',
        route: '/tools/marketing',
      },
      {
        id: 'clients',
        title: 'Clients',
        description: 'The people and companies that pay, one salon each.',
        icon: 'users',
        route: '/tools/clients',
      },
    ],
  },
  {
    id: 'salons',
    title: 'Salons & support',
    who: 'Setting up and looking after salons',
    tools: [
      {
        id: 'salons',
        title: 'Salons',
        description: 'Every salon with its client, plan, domains and full story.',
        icon: 'store',
        route: '/tools/salons',
      },
      {
        id: 'onboarding',
        title: 'Onboarding',
        description: 'New salons live within 48h of their materials: checklist and clock.',
        icon: 'rocket',
        route: '/tools/onboarding',
      },
      {
        id: 'support',
        title: 'Support',
        description: 'Tickets from salons, included sessions and billable time.',
        icon: 'life-buoy',
        route: '/tools/support',
      },
      {
        id: 'features',
        title: 'Feature requests',
        description: 'What salons ask for, weighed by the revenue behind it.',
        icon: 'bulb',
        route: '/tools/features',
      },
      {
        id: 'contracts',
        title: 'Contracts',
        description: 'Signed contracts, DPAs (GDPR), renewals and missing paperwork.',
        icon: 'file',
        route: '/tools/contracts',
      },
    ],
  },
  {
    id: 'money',
    title: 'Money',
    who: 'Revenue, costs and the numbers vs. the plan',
    tools: [
      {
        id: 'subscriptions',
        title: 'Subscriptions',
        description: 'MRR, plans, Early Bird trials and payments to collect.',
        icon: 'repeat',
        route: '/tools/subscriptions',
      },
      {
        id: 'finances',
        title: 'Finances',
        description: 'Transactions, recurring payments, accounts and budgets.',
        icon: 'wallet',
        route: '/tools/finances',
      },
      {
        id: 'kpis',
        title: 'KPIs',
        description: 'Paying salons, MRR, retention, trial → paid and onboarding time vs. the plan.',
        icon: 'trending',
        route: '/tools/kpis',
      },
    ],
  },
  {
    id: 'planning',
    title: 'Planning',
    who: 'What to do and when',
    tools: [
      {
        id: 'tasks',
        title: 'Tasks',
        description: 'Year 1 goals split into tasks with owners and due months.',
        icon: 'list-checks',
        route: '/tools/tasks',
      },
      {
        id: 'roadmap',
        title: 'Roadmap',
        description: 'Phase checklists and paying salons against break-even.',
        icon: 'map',
        route: '/tools/roadmap',
      },
      {
        id: 'calendar',
        title: 'Calendar',
        description: 'Deadlines: taxes, funding, domains, contracts, trials.',
        icon: 'calendar',
        route: '/tools/calendar',
      },
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    who: 'Running the platform and the know-how',
    tools: [
      {
        id: 'infra',
        title: 'Infra',
        description: 'Monthly service costs, SMS against the budget, backups and restore tests.',
        icon: 'server',
        route: '/tools/infra',
      },
      {
        id: 'wiki',
        title: 'Wiki',
        description: 'How-tos and SOPs: onboarding, deploys, JSON config, backups, sales.',
        icon: 'book',
        route: '/tools/wiki',
      },
      {
        id: 'files',
        title: 'Files',
        description: 'Shared documents: PDFs, decks, spreadsheets and more.',
        icon: 'paperclip',
        route: '/tools/files',
      },
    ],
  },
];

/** Every tool, in group order. */
export const TOOLS: readonly ToolDefinition[] = TOOL_GROUPS.flatMap((g) => g.tools);

export const OVERVIEW_LINK: NavLink = { label: 'Overview', route: '/', icon: 'home', exact: true };

export const toNavLink = (t: ToolDefinition): NavLink => ({ label: t.title, route: t.route, icon: t.icon, exact: false });

export const TOOL_LINKS: readonly NavLink[] = TOOLS.map(toNavLink);
