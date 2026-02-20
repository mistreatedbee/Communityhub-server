import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import plansRoutes from './routes/plans.routes.js';
import licensesRoutes from './routes/licenses.routes.js';
import tenantsRoutes from './routes/tenants.routes.js';
import profileRoutes from './routes/profile.routes.js';
import auditRoutes from './routes/audit.routes.js';
import onboardingRoutes from './routes/onboarding.routes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiRateLimit, authRateLimit } from './middleware/rateLimit.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use(apiRateLimit);

  app.get('/', (_req, res) => {
    res.status(200).json({
      message: 'CommunityHub API is running',
      healthEndpoint: '/health',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api/auth', authRateLimit, authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/plans', plansRoutes);
  app.use('/api/licenses', licensesRoutes);
  app.use('/api/onboarding', onboardingRoutes);
  app.use('/api/tenants', tenantsRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/audit', auditRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

