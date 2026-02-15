const { createAsyncRouter } = require('../middleware');
const { sanitizeText, toBoolean, pickRole, nowIso, serializeUser, serializeResult } = require('../utils');
const { logAdminAction } = require('../db');

function createAdminUsersRouter(db) {
  const router = createAsyncRouter();

  router.get('/', async (req, res) => {
    const search = sanitizeText(req.query.search || '', 120).toLowerCase();
    const role = sanitizeText(req.query.role || '', 20).toLowerCase();

    const where = ['1 = 1'];
    const params = [];

    if (search) {
      where.push('(LOWER(full_name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(university) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (role) {
      where.push('role = ?');
      params.push(role);
    }

    const users = await db.all(
      `SELECT id, full_name, email, university, city, role, is_banned, points, total_tests, registration_date, last_login_at
       FROM users
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT 500`,
      params
    );

    res.json({ users: users.map((u) => ({ ...u, is_banned: !!u.is_banned })) });
  });

  router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'User topilmadi' });

    const history = await db.all(
      `SELECT r.*, t.title as test_title
       FROM results r
       LEFT JOIN tests t ON t.id = r.test_id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [id]
    );

    const warnings = await db.all(
      `SELECT w.*, a.full_name as admin_name
       FROM user_warnings w
       LEFT JOIN users a ON a.id = w.admin_id
       WHERE w.user_id = ?
       ORDER BY w.created_at DESC
       LIMIT 20`,
      [id]
    );

    res.json({
      user: serializeUser(user),
      history: history.map((item) => ({ ...serializeResult(item), test_title: item.test_title })),
      warnings
    });
  });

  router.patch('/:id/ban', async (req, res) => {
    const id = Number(req.params.id);
    const banned = toBoolean(req.body.banned);

    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'User topilmadi' });

    if (req.authUser.id === id) {
      return res.status(400).json({ error: 'Oz accountingizni bloklay olmaysiz' });
    }

    if (user.role === 'admin' && req.authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Faqat admin boshqa adminni boshqara oladi' });
    }

    await db.run('UPDATE users SET is_banned = ?, updated_at = ? WHERE id = ?', [banned ? 1 : 0, nowIso(), id]);
    await logAdminAction(db, req.authUser.id, 'users:ban', 'user', id, { banned });

    const updated = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    res.json({ user: serializeUser(updated) });
  });

  router.patch('/:id/role', async (req, res) => {
    if (req.authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Faqat admin rolni ozgartira oladi' });
    }

    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const role = pickRole(sanitizeText(req.body.role, 20).toLowerCase(), 'student');
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'User topilmadi' });

    if (req.authUser.id === id && role !== 'admin') {
      return res.status(400).json({ error: 'Oz rolini admin dan tushirib bolmaydi' });
    }

    if (user.role === 'admin' && role !== 'admin') {
      const admins = await db.get(`SELECT COUNT(*) as count FROM users WHERE role='admin'`);
      if ((admins.count || 0) <= 1) {
        return res.status(400).json({ error: 'Kamida bitta admin qolishi shart' });
      }
    }

    await db.run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, nowIso(), id]);
    await logAdminAction(db, req.authUser.id, 'users:role', 'user', id, { role });

    const updated = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    res.json({ user: serializeUser(updated) });
  });

  return router;
}

module.exports = createAdminUsersRouter;
