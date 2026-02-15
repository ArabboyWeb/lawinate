const bcrypt = require('bcryptjs');
const { createAsyncRouter } = require('../middleware');
const { sanitizeText, toBoolean, isAllowed, nowIso, serializeUser } = require('../utils');
const { logAdminAction } = require('../db');

function createAdminSettingsRouter(db) {
  const router = createAsyncRouter();

  router.get('/', async (_req, res) => {
    const settings = await db.get('SELECT * FROM site_settings WHERE id = 1');
    res.json({
      settings: {
        site_name: settings?.site_name || 'Lawinate.uz',
        maintenance_mode: !!settings?.maintenance_mode,
        allow_registration: !!settings?.allow_registration,
        updated_at: settings?.updated_at
      }
    });
  });

  router.put('/', async (req, res) => {
    if (req.authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Faqat admin bu amalni bajaradi' });
    }

    const siteName = sanitizeText(req.body.site_name, 120) || 'Lawinate.uz';
    const maintenance = toBoolean(req.body.maintenance_mode) ? 1 : 0;
    const allowReg = toBoolean(req.body.allow_registration) ? 1 : 0;

    await db.run(
      `UPDATE site_settings
       SET site_name=?, maintenance_mode=?, allow_registration=?, updated_at=?
       WHERE id=1`,
      [siteName, maintenance, allowReg, nowIso()]
    );

    await logAdminAction(db, req.authUser.id, 'settings:update', 'site_settings', 1, {
      site_name: siteName,
      maintenance_mode: !!maintenance,
      allow_registration: !!allowReg
    });

    const updated = await db.get('SELECT * FROM site_settings WHERE id = 1');
    res.json({
      settings: {
        site_name: updated.site_name,
        maintenance_mode: !!updated.maintenance_mode,
        allow_registration: !!updated.allow_registration,
        updated_at: updated.updated_at
      }
    });
  });

  router.get('/admins', async (_req, res) => {
    const admins = await db.all(
      `SELECT id, full_name, email, role, is_banned, last_login_at, created_at
       FROM users
       WHERE role IN ('admin', 'moderator')
       ORDER BY role DESC, created_at ASC`
    );

    res.json({ admins: admins.map((a) => ({ ...a, is_banned: !!a.is_banned })) });
  });

  router.post('/admins', async (req, res) => {
    if (req.authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Faqat admin yangi admin/moderator yarata oladi' });
    }

    const fullName = sanitizeText(req.body.full_name, 120);
    const email = sanitizeText(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || '');
    const role = isAllowed(sanitizeText(req.body.role, 20).toLowerCase(), ['admin', 'moderator'], 'moderator');

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'full_name, email, password kerak' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Parol kamida 8 ta belgi bolishi kerak' });
    }

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Bu email allaqachon mavjud' });

    const hash = await bcrypt.hash(password, 12);
    const created = await db.run(
      `INSERT INTO users (full_name, email, password_hash, role, is_banned, registration_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)` ,
      [fullName, email, hash, role, nowIso(), nowIso(), nowIso()]
    );

    await logAdminAction(db, req.authUser.id, 'settings:admin:create', 'user', created.lastID, { role, email });

    const user = await db.get('SELECT * FROM users WHERE id = ?', [created.lastID]);
    res.status(201).json({ admin: serializeUser(user) });
  });

  router.delete('/admins/:id', async (req, res) => {
    if (req.authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Faqat admin bu amalni bajaradi' });
    }

    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const target = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!target) return res.status(404).json({ error: 'Admin topilmadi' });

    if (!['admin', 'moderator'].includes(target.role)) {
      return res.status(400).json({ error: 'Target admin/moderator emas' });
    }

    if (req.authUser.id === id) {
      return res.status(400).json({ error: 'Oz accountingizni olib tashlay olmaysiz' });
    }

    if (target.role === 'admin') {
      const count = await db.get(`SELECT COUNT(*) as count FROM users WHERE role='admin'`);
      if ((count.count || 0) <= 1) {
        return res.status(400).json({ error: 'Kamida bitta admin qolishi shart' });
      }
    }

    await db.run(`UPDATE users SET role='student', updated_at=? WHERE id=?`, [nowIso(), id]);
    await logAdminAction(db, req.authUser.id, 'settings:admin:remove', 'user', id, { old_role: target.role });

    res.json({ ok: true });
  });

  router.get('/schema', async (_req, res) => {
    res.json({
      tables: [
        'users',
        'tests',
        'questions',
        'results',
        'books',
        'community_posts',
        'community_comments',
        'community_reports',
        'user_warnings',
        'ai_prompt_logs',
        'ai_settings',
        'faq_templates',
        'site_settings',
        'admin_activity_logs',
        'password_resets',
        'chat_groups',
        'chat_group_members',
        'chat_messages'
      ]
    });
  });

  return router;
}

module.exports = createAdminSettingsRouter;
