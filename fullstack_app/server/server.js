const express = require('express');
const cors = require('cors');
const { initDb, ADMIN_SEED_EMAIL } = require('./src/db');
const { sanitizeBody, createAuth, errorHandler, asyncHandler } = require('./src/middleware');

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

async function createServer() {
  const db = await initDb();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '8mb' }));
  app.use(sanitizeBody);

  const authRequired = createAuth(db);
  const adminRequired = createAuth(db, { adminOnly: true });

  app.use('/api', createPublicRouter(db, authRequired));
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
      console.log(`Admin login seed -> ${ADMIN_SEED_EMAIL}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
