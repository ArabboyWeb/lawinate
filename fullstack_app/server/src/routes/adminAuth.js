const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createAsyncRouter } = require('../middleware');
const { ADMIN_ROLES, sanitizeText, toBoolean, createToken, serializeUser, nowIso } = require('../utils');
const { logAdminAction } = require('../db');

function createAdminAuthRouter(db, adminRequired) {
  const router = createAsyncRouter();

  router.post('/login', async (req, res) => {
    const email = sanitizeText(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || '');
    const rememberMe = toBoolean(req.body.remember_me);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email va parol kiritilishi shart' });
    }

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return res.status(401).json({ error: 'Admin huquqi topilmadi' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: 'Ushbu akkaunt Google orqali ro\'yxatdan o\'tgan' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Login yoki parol xato' });
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'Sizning akkauntingiz bloklangan' });
    }

    await db.run('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?', [nowIso(), nowIso(), user.id]);
    const token = createToken(jwt, user, rememberMe);

    await logAdminAction(db, user.id, 'auth:login', 'admin', user.id, { remember_me: rememberMe });

    return res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        last_login_at: nowIso()
      }
    });
  });

  router.post('/forgot-password', async (req, res) => {
    const email = sanitizeText(req.body.email, 120).toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email kerak' });
    }

    await db.run(
      `INSERT INTO password_resets (email, request_ip, created_at)
       VALUES (?, ?, ?)` ,
      [email, sanitizeText(req.ip || '', 100), nowIso()]
    );

    return res.json({
      message: 'Parol tiklash funksiyasi hozircha placeholder. Admin bilan boglaning.'
    });
  });

  router.get('/me', adminRequired, async (req, res) => {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.authUser.id]);
    res.json({ user: serializeUser(user) });
  });

  router.post('/logout', adminRequired, async (req, res) => {
    await logAdminAction(db, req.authUser.id, 'auth:logout', 'admin', req.authUser.id);
    res.json({ ok: true });
  });

  return router;
}

module.exports = createAdminAuthRouter;
