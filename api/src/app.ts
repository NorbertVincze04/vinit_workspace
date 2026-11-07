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
import { filesRouter } from './modules/files/files.routes.js';
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
  secured.use('/settings', settingsRouter());
  secured.use('/roadmap', roadmapRouter());
  secured.use('/files', filesRouter());
  for (const resource of TOOL_RESOURCES) secured.use(`/${resource.name}`, resourceRouter(resource));
  api.use(secured);

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
