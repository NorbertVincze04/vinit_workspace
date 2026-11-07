import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

/**
 * Every page is lazy-loaded. To add a tool page:
 *   1. add a route inside the signed-in group below,
 *   2. register it in core/data/tools.data.ts — the sidebar and overview pick it up.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · VINIT Workspace',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    // Everything else needs a signed-in team member.
    path: '',
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        title: 'Overview · VINIT Workspace',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'tools/kpis',
        title: 'KPIs · VINIT Workspace',
        loadComponent: () => import('./features/tools/kpis/kpis-page.component').then((m) => m.KpisPageComponent),
      },
      {
        path: 'tools/tasks',
        title: 'Tasks · VINIT Workspace',
        loadComponent: () => import('./features/tools/tasks/tasks-page.component').then((m) => m.TasksPageComponent),
      },
      {
        path: 'tools/leads',
        title: 'Leads · VINIT Workspace',
        loadComponent: () => import('./features/tools/leads/leads-page.component').then((m) => m.LeadsPageComponent),
      },
      {
        path: 'tools/salons',
        title: 'Salons · VINIT Workspace',
        loadComponent: () => import('./features/tools/salons/salons-page.component').then((m) => m.SalonsPageComponent),
      },
      {
        path: 'tools/salons/:id',
        title: 'Salon · VINIT Workspace',
        loadComponent: () =>
          import('./features/tools/salons/detail/salon-detail-page.component').then((m) => m.SalonDetailPageComponent),
      },
      {
        path: 'tools/onboarding',
        title: 'Onboarding · VINIT Workspace',
        loadComponent: () =>
          import('./features/tools/onboarding/onboarding-page.component').then((m) => m.OnboardingPageComponent),
      },
      {
        path: 'tools/subscriptions',
        title: 'Subscriptions · VINIT Workspace',
        loadComponent: () =>
          import('./features/tools/subscriptions/subscriptions-page.component').then((m) => m.SubscriptionsPageComponent),
      },
      {
        path: 'tools/support',
        title: 'Support · VINIT Workspace',
        loadComponent: () => import('./features/tools/support/support-page.component').then((m) => m.SupportPageComponent),
      },
      {
        path: 'tools/features',
        title: 'Feature requests · VINIT Workspace',
        loadComponent: () => import('./features/tools/features/features-page.component').then((m) => m.FeaturesPageComponent),
      },
      {
        path: 'tools/contracts',
        title: 'Contracts · VINIT Workspace',
        loadComponent: () => import('./features/tools/contracts/contracts-page.component').then((m) => m.ContractsPageComponent),
      },
      {
        path: 'tools/clients',
        title: 'Clients · VINIT Workspace',
        loadComponent: () =>
          import('./features/tools/clients/clients-page.component').then((m) => m.ClientsPageComponent),
      },
      {
        path: 'tools/finances',
        title: 'Finances · VINIT Workspace',
        loadComponent: () =>
          import('./features/tools/finances/finances-page.component').then((m) => m.FinancesPageComponent),
      },
      {
        path: 'tools/marketing',
        title: 'Marketing · VINIT Workspace',
        loadComponent: () =>
          import('./features/tools/marketing/marketing-page.component').then((m) => m.MarketingPageComponent),
      },
      {
        path: 'tools/roadmap',
        title: 'Roadmap · VINIT Workspace',
        loadComponent: () =>
          import('./features/tools/roadmap/roadmap-page.component').then((m) => m.RoadmapPageComponent),
      },
      {
        path: 'tools/files',
        title: 'Files · VINIT Workspace',
        loadComponent: () => import('./features/tools/files/files-page.component').then((m) => m.FilesPageComponent),
      },
      // Old address of the Files tool.
      { path: 'tools/appendices', redirectTo: 'tools/files' },
      {
        path: '**',
        title: 'Page not found · VINIT Workspace',
        loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
      },
    ],
  },
];
