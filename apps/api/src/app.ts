import { randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { PrismaClient } from '@showroom/database';
import type { Config } from './config.js';
import { ApiError, errorHandler } from './errors.js';
import { authRoutes, requireOwner } from './auth.js';
import { catalogueRoutes } from './modules/catalogue/routes.js';
import { imageRoutes } from './modules/images/routes.js';
import type { ImageStorage } from './modules/images/cloudinary.js';
import { cmsRoutes } from './modules/cms/routes.js';
import { crmRoutes } from './modules/crm/routes.js';
import { tryOnRoutes } from './modules/tryon/routes.js';
import { createTryOnRuntime } from './modules/tryon/runtime.js';

export function createApp(db: PrismaClient, config: Config, logger: Logger, imageStorage?: ImageStorage, tryOn = createTryOnRuntime(db)) {
  const app = express();
  app.disable('x-powered-by');
  if (config.TRUST_PROXY) app.set('trust proxy', 1);
  app.use(helmet());
  app.use(pinoHttp({ logger, genReqId: () => randomUUID(),
    serializers: {
      req: req => ({ id: req.id, method: req.method, path: String(req.url).split('?')[0] }),
      res: res => ({ statusCode: res.statusCode }),
    },
  }));
  // Set this before any middleware that can answer or reject an owner request.
  app.use(['/api/auth', '/api/admin'], (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });
  app.use(cors({ origin: config.WEB_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
  // Cookie-authenticated mutations require the configured origin, including login (login CSRF).
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') !== config.WEB_ORIGIN) {
      throw new ApiError(403, 'ORIGIN_REJECTED', 'This request did not originate from the showroom website.');
    }
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' } },
  }));
  app.get('/api/health/live', (_req, res) => res.json({ data: { status: 'ok' } }));
  app.get('/api/health/ready', async (_req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      // Verify migrations were applied, not just that a TCP connection is available.
      await db.websiteSetting.count();
      res.json({ data: { status: 'ready' } });
    } catch {
      res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Database connection or migrations are not ready.' } });
    }
  });
  app.use('/api/auth', authRoutes(db, config));
  app.use('/api', tryOnRoutes(db, config, tryOn, imageStorage));
  app.use('/api/admin', imageRoutes(db, logger, imageStorage));
  app.use('/api', catalogueRoutes(db));
  app.use('/api', cmsRoutes(db));
  app.use('/api', crmRoutes(db));
  app.get('/api/admin/setup-status', requireOwner(db), async (_req, res) => {
    const [products, categories, settings] = await Promise.all([db.product.count({ where: { deletedAt: null } }), db.category.count(), db.websiteSetting.count()]);
    res.json({ data: { products, categories, settings } });
  });
  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'This endpoint does not exist.')));
  app.use(errorHandler(logger));
  return app;
}
