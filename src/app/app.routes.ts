import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { t } from './core/i18n/i18n';

/**
 * Every page is lazy-loaded. To add a tool page:
 *   1. add a route inside the signed-in group below,
 *   2. register it in core/data/tools.data.ts — the sidebar and overview pick it up.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: t('Sign in') + ' · VINIT Workspace',
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
        title: t('Overview') + ' · VINIT Workspace',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'activity',
        title: t('Activity') + ' · VINIT Workspace',
        loadComponent: () => import('./features/activity/activity-page.component').then((m) => m.ActivityPageComponent),
      },
      {
        path: 'tools/kpis',
        title: t('KPIs') + ' · VINIT Workspace',
        loadComponent: () => import('./features/tools/kpis/kpis-page.component').then((m) => m.KpisPageComponent),
      },
      {
        path: 'tools/tasks',
        title: t('Tasks') + ' · VINIT Workspace',
        loadComponent: () => import('./features/tools/tasks/tasks-page.component').then((m) => m.TasksPageComponent),
      },
      {
        path: 'tools/leads',
        title: t('Leads') + ' · VINIT Workspace',
        loadComponent: () => import('./features/tools/leads/leads-page.component').then((m) => m.LeadsPageComponent),
      },
      {
        path: 'tools/salons',
        title: t('Salons') + ' · VINIT Workspace',
        loadComponent: () => import('./features/tools/salons/salons-page.component').then((m) => m.SalonsPageComponent),
      },
      {
        path: 'tools/salons/:id',
        title: t('Salon') + ' · VINIT Workspace',
        loadComponent: () =>
          import('./features/tools/salons/detail/salon-detail-page.component').then((m) => m.SalonDetailPageComponent),
      },
      {
        path: 'tools/onboarding',
        title: t('Onboarding') + ' · VINIT Workspace',
        loadComponent: () =>
          import('./features/tools/onboarding/onboarding-page.component').then((m) => m.OnboardingPageComponent),
      },
      {
        path: 'tools/subscriptions',
        title: t('Subscriptions') + ' · VINIT Workspace',
        loadComponent: () =>
          import('./features/tools/subscriptions/subscriptions-page.component').then((m) => m.SubscriptionsPageComponent),
      },
      {
        path: 'tools/support',
        title: t('Support') + ' · VINIT Workspace',
        loadComponent: () => import('./features/tools/support/support-page.component').then((m) => m.SupportPageComponent),
      },
      {
        path: 'tools/features',
        title: t('Feature requests') + ' · VINIT Workspace',
        loadComponent: () => import('./features/tools/features/features-page.component').then((m) => m.FeaturesPageComponent),
      },
      {
        path: 'tools/contracts',
        title: t('Contracts') + ' · VINIT Workspace',
        loadComponent: () => import('./features/tools/contracts/contracts-page.component').then((m) => m.ContractsPageComponent),
      },
      {
        path: 'tools/calendar',
        title: t('Calendar') + ' · VINIT Workspace',
        loadComponent: () => import('./features/tools/calendar/calendar-page.component').then((m) => m.CalendarPageComponent),
      },
      {
        path: 'tools/wiki',
        title: t('Wiki') + ' · VINIT Workspace',
        loadComponent: () => import('./features/tools/wiki/wiki-page.component').then((m) => m.WikiPageComponent),
      },
      {
        path: 'tools/wiki/:slug',
        title: t('Wiki') + ' · VINIT Workspace',
        loadComponent: () => import('./features/tools/wiki/wiki-article.component').then((m) => m.WikiArticleComponent),
      },
      {
        path: 'tools/infra',
        title: t('Infra') + ' · VINIT Workspace',
        loadComponent: () => import('./features/tools/infra/infra-page.component').then((m) => m.InfraPageComponent),
      },
      // Clients are managed on each salon now (billing details); old links land on Salons.
      { path: 'tools/clients', redirectTo: 'tools/salons' },
      {
        path: 'tools/finances',
        title: t('Finances') + ' · VINIT Workspace',
        loadComponent: () =>
          import('./features/tools/finances/finances-page.component').then((m) => m.FinancesPageComponent),
      },
      {
        path: 'tools/marketing',
        title: t('Marketing') + ' · VINIT Workspace',
        loadComponent: () =>
          import('./features/tools/marketing/marketing-page.component').then((m) => m.MarketingPageComponent),
      },
      {
        path: 'tools/roadmap',
        title: t('Roadmap') + ' · VINIT Workspace',
        loadComponent: () =>
          import('./features/tools/roadmap/roadmap-page.component').then((m) => m.RoadmapPageComponent),
      },
      {
        path: 'tools/files',
        title: t('Files') + ' · VINIT Workspace',
        loadComponent: () => import('./features/tools/files/files-page.component').then((m) => m.FilesPageComponent),
      },
      // Old address of the Files tool.
      { path: 'tools/appendices', redirectTo: 'tools/files' },
      {
        path: '**',
        title: t('Page not found') + ' · VINIT Workspace',
        loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
      },
    ],
  },
];
