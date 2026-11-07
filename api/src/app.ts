import cookieParser from 'cookie-parser';
import express, { Router } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { db } from './db/knex.js';
import { errorHandler, notFoundHandler } from './http/errors.js';

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

  api.get('/health', async (_req, res) => {
    await db.raw('select 1');
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
