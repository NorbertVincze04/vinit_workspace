import { NavLink, ToolDefinition } from '../models';

/**
 * Workspace tools registry.
 * To add a tool: create its page under features/tools, add a route in app.routes.ts,
 * then add an entry here with status 'live' — header, footer and overview pick it up.
 */
export const TOOLS: readonly ToolDefinition[] = [
  {
    id: 'roadmap',
    title: 'Roadmap',
    description: 'Four phases over twelve months and one number to watch: paying salons against break-even.',
    icon: 'map',
    status: 'live',
    route: '/tools/roadmap',
  },
  {
    id: 'tasks',
    title: 'Tasks',
    description: 'Every Year 1 goal split into small tasks, with owners, due months, filters and backups.',
    icon: 'list-checks',
    status: 'live',
    route: '/tools/tasks',
  },
  {
    id: 'clients',
    title: 'Clients',
    description: 'Salon pipeline from first contact to paying customer, with MRR against break-even.',
    icon: 'users',
    status: 'live',
    route: '/tools/clients',
  },
  {
    id: 'finances',
    title: 'Finances',
    description: 'Transactions, recurring costs, investments, accounts and budgets, with monthly cash flow.',
    icon: 'wallet',
    status: 'live',
    route: '/tools/finances',
  },
  {
    id: 'marketing',
    title: 'Marketing plan',
    description: 'The 12-month content calendar with copy, platforms and the communication mix.',
    icon: 'megaphone',
    status: 'live',
    route: '/tools/marketing',
  },
];

export const LIVE_TOOLS = TOOLS.filter((t) => t.status === 'live' && !!t.route);

export const NAV_LINKS: readonly NavLink[] = [
  { label: 'Overview', route: '/', icon: 'home', exact: true },
  ...LIVE_TOOLS.map((t) => ({ label: t.title, route: t.route as string, icon: t.icon, exact: false })),
];
