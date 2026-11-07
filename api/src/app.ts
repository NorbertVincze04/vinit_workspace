import cookieParser from 'cookie-parser';
import express, { Router } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { db } from './db/knex.js';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { requireAppHeader, requireAuth } from './modules/auth/auth.middleware.js';
import { resourceRouter } from './lib/resource.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/auth/users.routes.js';
import { filesRouter } from './modules/files/files.routes.js';
import { metricsRouter, paymentsRouter, salonSubscriptionsRouter, subscriptionsRouter } from './modules/billing/billing.routes.js';
import { onboardingRouter, salonOnboardingRouter } from './modules/onboarding/onboarding.routes.js';
import { supportRouter } from './modules/support/support.routes.js';
import { contractsRouter } from './modules/contracts/contracts.routes.js';
import { deadlinesRouter } from './modules/deadlines/deadlines.routes.js';
import { wikiRouter } from './modules/wiki/wiki.routes.js';
import { infraRouter } from './modules/infra/infra.routes.js';
import { activityRouter } from './modules/activity/activity.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { searchRouter } from './modules/search/search.routes.js';
import { integrationsRouter } from './integrations/integrations.routes.js';
import { featuresRouter } from './modules/features/features.routes.js';
import { kpisRouter } from './modules/kpis/kpis.routes.js';
import { leadsRouter } from './modules/leads/leads.routes.js';
import { legacyImportRouter } from './modules/salons/legacy-import.routes.js';
import { clientsRouter } from './modules/salons/clients.routes.js';
import { plansRouter, promotionsRouter } from './modules/salons/plans.routes.js';
import { domainsRouter, salonsRouter } from './modules/salons/salons.routes.js';
import { roadmapRouter } from './modules/roadmap/roadmap.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { TOOL_RESOURCES } from './modules/tools/tools.resources.js';

/** Builds the Express app (no listen), so tests can drive it with supertest. */
export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(helmet());
  if (!config.isTest) app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

  const api = Router();
  api.use(requireAppHeader);

  // Public: health check and sign-in.
  api.get('/health', async (_req, res) => {
    await db.raw('select 1');
    res.json({ ok: true, time: new Date().toISOString() });
  });
  api.use('/auth', authRouter());

  // Everything below needs a signed-in user.
  const secured = Router();
  secured.use(requireAuth);
  secured.use('/users', usersRouter());
  secured.use('/settings', settingsRouter());
  secured.use('/roadmap', roadmapRouter());
  secured.use('/files', filesRouter());
  for (const resource of TOOL_RESOURCES) secured.use(`/${resource.name}`, resourceRouter(resource));
  // Salon platform (Phase 2+): everything links to a salon.
  secured.use('/clients', clientsRouter());
  secured.use('/salons', salonsRouter());
  secured.use('/domains', domainsRouter());
  secured.use('/plans', plansRouter());
  secured.use('/promotions', promotionsRouter());
  secured.use('/leads', leadsRouter());
  secured.use('/salons/:id/subscriptions', salonSubscriptionsRouter());
  secured.use('/subscriptions', subscriptionsRouter());
  secured.use('/payments', paymentsRouter());
  secured.use('/metrics', metricsRouter());
  secured.use('/salons/:id/onboarding', salonOnboardingRouter());
  secured.use(onboardingRouter());
  secured.use(supportRouter());
  secured.use('/import', legacyImportRouter());
  secured.use('/kpis', kpisRouter());
  secured.use(featuresRouter());
  secured.use('/contracts', contractsRouter());
  secured.use('/deadlines', deadlinesRouter());
  secured.use('/wiki', wikiRouter());
  secured.use('/infra', infraRouter());
  secured.use('/activity', activityRouter());
  secured.use('/notifications', notificationsRouter());
  secured.use('/search', searchRouter());
  secured.use('/integrations', integrationsRouter());
  api.use(secured);

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
