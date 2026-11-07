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
        path: 'tools/tasks',
        title: 'Tasks · VINIT Workspace',
        loadComponent: () => import('./features/tools/tasks/tasks-page.component').then((m) => m.TasksPageComponent),
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
