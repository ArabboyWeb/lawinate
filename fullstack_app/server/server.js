require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const { query } = require('./db');
const { initDb, ADMIN_SEED_EMAIL } = require('./src/db');
const {
  sanitizeBody,
  createAuth,
  createOptionalAuth,
  errorHandler
} = require('./src/middleware');
const { checkPostgresConnection } = require('./src/pg');
const { getConfiguredFrontendOrigins, isAllowedFrontendOrigin } = require('./src/utils');

const createAnalyticsRouter = require('./src/routes/analytics');
const createPublicRouter = require('./src/routes/public');
const createPublicChatRouter = require('./src/routes/publicChat');
const createAdminAuthRouter = require('./src/routes/adminAuth');
const createAdminDashboardRouter = require('./src/routes/adminDashboard');
const createAdminTestsRouter = require('./src/routes/adminTests');
const createAdminLibraryRouter = require('./src/routes/adminLibrary');
const createAdminUsersRouter = require('./src/routes/adminUsers');
const createAdminCommunityRouter = require('./src/routes/adminCommunity');
const createAdminAIRouter = require('./src/routes/adminAI');
const createAdminSettingsRouter = require('./src/routes/adminSettings');

const PORT = process.env.PORT || 3001;

function validateEnv() {
  const missing = [];
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (process.env.NODE_ENV === 'production' && !process.env.APP_BASE_URL && !process.env.CLIENT_URL) {
    missing.push('APP_BASE_URL or CLIENT_URL');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const explicitDbClient = String(process.env.DB_CLIENT || '').trim().toLowerCase();
  if (explicitDbClient && explicitDbClient !== 'postgres') {
    throw new Error('Only PostgreSQL/Neon is supported. Remove DB_CLIENT=sqlite and use DATABASE_URL.');
  }
}

function getCorsConfig() {
  const configured = getConfiguredFrontendOrigins();

  return {
    origin(origin, callback) {
      if (!origin || configured.length === 0 || isAllowedFrontendOrigin(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    optionsSuccessStatus: 204
  };
}

async function createServer() {
  validateEnv();
  const db = await initDb();
  await checkPostgresConnection();

  if (!process.env.OPENROUTER_API_KEY) {
    console.warn('OPENROUTER_API_KEY is not set. AI endpoint /api/ai will return 503 until you add a real key.');
  }

  const app = express();
  const corsConfig = getCorsConfig();
  app.use(cors(corsConfig));
  app.options('*', cors(corsConfig));
  app.use(express.json({ limit: '8mb' }));
  app.use(sanitizeBody);
  app.get('/api/db-test', async (_req, res) => {
    try {
      const result = await query('SELECT CURRENT_TIMESTAMP AS db_time');
      return res.json({
        status: 'connected',
        db_time: result.rows[0]?.db_time || null
      });
    } catch (err) {
      return res.status(500).json({
        status: 'error',
        error: err?.message || String(err)
      });
    }
  });

  const authRequired = createAuth(db);
  const adminRequired = createAuth(db, { adminOnly: true });
  const optionalAuth = createOptionalAuth(db);

  app.use('/api/analytics', createAnalyticsRouter(db, optionalAuth));
  app.use(
    '/api',
    createPublicRouter(db, authRequired, async () => {
      await db.get('SELECT 1 AS ok');
      const postgres = await checkPostgresConnection();
      return {
        primary: 'postgres',
        postgres
      };
    })
  );
  app.use('/api/chat', authRequired, createPublicChatRouter(db));

  app.use('/api/admin/auth', createAdminAuthRouter(db, adminRequired));
  app.use('/api/admin/dashboard', adminRequired, createAdminDashboardRouter(db));
  app.use('/api/admin', adminRequired, createAdminTestsRouter(db));
  app.use('/api/admin/library', adminRequired, createAdminLibraryRouter(db));
  app.use('/api/admin/users', adminRequired, createAdminUsersRouter(db));
  app.use('/api/admin/community', adminRequired, createAdminCommunityRouter(db));
  app.use('/api/admin/ai', adminRequired, createAdminAIRouter(db));
  app.use('/api/admin/settings', adminRequired, createAdminSettingsRouter(db));

  app.use(errorHandler);

  return app;
}

createServer()
  .then((app) => {
    app.listen(PORT, () => {
      console.log(`Lawinate API is running on port ${PORT}`);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Admin login seed -> ${ADMIN_SEED_EMAIL}`);
      }
    });
  })
  .catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
