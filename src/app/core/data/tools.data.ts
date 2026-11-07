import { NavLink, ToolDefinition } from '../models';

/**
 * Workspace tools registry — the single source for the sidebar and the overview launcher.
 * To add a tool: create its page under features/tools, add a route in app.routes.ts, then add it here.
 */
export const TOOLS: readonly ToolDefinition[] = [
  {
    id: 'tasks',
    title: 'Tasks',
    description: 'Year 1 goals split into tasks with owners and due months.',
    icon: 'list-checks',
    route: '/tools/tasks',
  },
  {
    id: 'clients',
    title: 'Clients',
    description: 'Salon pipeline from first contact to paying customer.',
    icon: 'users',
    route: '/tools/clients',
  },
  {
    id: 'finances',
    title: 'Finances',
    description: 'Transactions, recurring payments, accounts and budgets.',
    icon: 'wallet',
    route: '/tools/finances',
  },
  {
    id: 'marketing',
    title: 'Marketing',
    description: '12-month content calendar with copy and platforms.',
    icon: 'megaphone',
    route: '/tools/marketing',
  },
  {
    id: 'roadmap',
    title: 'Roadmap',
    description: 'Phase checklists and paying salons against break-even.',
    icon: 'map',
    route: '/tools/roadmap',
  },
  {
    id: 'files',
    title: 'Files',
    description: 'Shared documents: PDFs, decks, spreadsheets and more.',
    icon: 'paperclip',
    route: '/tools/files',
  },
];

export const OVERVIEW_LINK: NavLink = { label: 'Overview', route: '/', icon: 'home', exact: true };

export const TOOL_LINKS: readonly NavLink[] = TOOLS.map((t) => ({
  label: t.title,
  route: t.route,
  icon: t.icon,
  exact: false,
}));
