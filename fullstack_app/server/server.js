require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const { query } = require('./db');
const { initDb, ADMIN_SEED_EMAIL } = require('./src/db');
const { sanitizeBody, createAuth, errorHandler, asyncHandler } = require('./src/middleware');
const { checkPostgresConnection } = require('./src/pg');

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
  if (process.env.NODE_ENV !== 'production') return;

  const missing = [];
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!process.env.APP_BASE_URL && !process.env.CLIENT_URL) missing.push('APP_BASE_URL or CLIENT_URL');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for production: ${missing.join(', ')}`);
  }
}

function getCorsConfig() {
  const configured = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigins = new Set(configured);

  return {
    origin(origin, callback) {
      if (!origin || configured.length === 0 || allowedOrigins.has(origin)) {
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
  const dbDriver = db.meta?.driver || 'sqlite';

  if (dbDriver === 'postgres') {
    await checkPostgresConnection();
  } else if (process.env.DATABASE_URL) {
    console.warn('DB_CLIENT=sqlite is active. PostgreSQL connection checks are skipped.');
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('DATABASE_URL is not set. PostgreSQL checks are disabled.');
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

  app.use(
    '/api',
    createPublicRouter(db, authRequired, async () => {
      await db.get('SELECT 1 AS ok');

      if (dbDriver === 'postgres') {
        const postgres = await checkPostgresConnection();
        return {
          primary: 'postgres',
          postgres
        };
      }

      if (process.env.DATABASE_URL) {
        const postgres = await checkPostgresConnection();
        return {
          primary: 'sqlite',
          sqlite: { ok: true },
          postgres
        };
      }

      return {
        primary: 'sqlite',
        sqlite: { ok: true },
        postgres: {
          ok: null,
          skipped: true,
          message: 'DATABASE_URL is not configured'
        }
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
