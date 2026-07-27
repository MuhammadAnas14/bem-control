const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const authRoutes = require('./api/auth/auth.routes');
const orgsRoutes = require('./api/orgs/orgs.routes');
const devicesRoutes = require('./api/devices/devices.routes');
const deviceGatewayRoutes = require('./api/deviceGateway/deviceGateway.routes');
const pushTokensRoutes = require('./api/pushTokens/pushTokens.routes');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '256kb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

  // Auth endpoints get a tighter rate limit - they're the most attractive
  // brute-force target (login) and abuse target (signup).
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
  app.use('/api/auth', authLimiter, authRoutes);

  app.use('/api/orgs', orgsRoutes);
  app.use('/api/orgs/:orgId/devices', devicesRoutes);
  app.use('/api/device', deviceGatewayRoutes);
  app.use('/api/push-tokens', pushTokensRoutes);

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
