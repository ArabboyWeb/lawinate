const { createAsyncRouter } = require('../middleware');
const { sanitizeText, isAllowed, nowIso } = require('../utils');
const { logAdminAction } = require('../db');

function createAdminCommunityRouter(db) {
  const router = createAsyncRouter();

  router.get('/posts', async (req, res) => {
    const search = sanitizeText(req.query.search || '', 150).toLowerCase();
    const status = sanitizeText(req.query.status || '', 20).toLowerCase();

    const where = ['1 = 1'];
    const params = [];

    if (search) {
      where.push('(LOWER(p.title) LIKE ? OR LOWER(p.content) LIKE ? OR LOWER(u.full_name) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      where.push('p.status = ?');
      params.push(status);
    }

    const posts = await db.all(
      `SELECT p.*, u.full_name as user_name, u.email as user_email
       FROM community_posts p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY p.is_pinned DESC, p.created_at DESC
       LIMIT 300`,
      params
    );

    res.json({ posts: posts.map((p) => ({ ...p, is_hidden: !!p.is_hidden, is_pinned: !!p.is_pinned })) });
  });

  router.get('/comments', async (req, res) => {
    const search = sanitizeText(req.query.search || '', 150).toLowerCase();
    const status = sanitizeText(req.query.status || '', 20).toLowerCase();

    const where = ['1 = 1'];
    const params = [];

    if (search) {
      where.push('(LOWER(c.content) LIKE ? OR LOWER(u.full_name) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) {
      where.push('c.status = ?');
      params.push(status);
    }

    const comments = await db.all(
      `SELECT c.*, u.full_name as user_name, p.title as post_title
       FROM community_comments c
       LEFT JOIN users u ON u.id = c.user_id
       LEFT JOIN community_posts p ON p.id = c.post_id
       WHERE ${where.join(' AND ')}
       ORDER BY c.created_at DESC
       LIMIT 300`,
      params
    );

    res.json({ comments: comments.map((c) => ({ ...c, is_hidden: !!c.is_hidden })) });
  });

  router.get('/reports', async (req, res) => {
    const status = sanitizeText(req.query.status || '', 20).toLowerCase();
    const where = ['1 = 1'];
    const params = [];

    if (status) {
      where.push('r.status = ?');
      params.push(status);
    }

    const reports = await db.all(
      `SELECT r.*, reporter.full_name as reporter_name, resolver.full_name as resolver_name
       FROM community_reports r
       LEFT JOIN users reporter ON reporter.id = r.reporter_id
       LEFT JOIN users resolver ON resolver.id = r.resolved_by
       WHERE ${where.join(' AND ')}
       ORDER BY r.created_at DESC
       LIMIT 300`,
      params
    );

    res.json({ reports });
  });

  router.patch('/posts/:id/action', async (req, res) => {
    const id = Number(req.params.id);
    const action = sanitizeText(req.body.action, 20).toLowerCase();

    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const post = await db.get('SELECT * FROM community_posts WHERE id = ?', [id]);
    if (!post) return res.status(404).json({ error: 'Post topilmadi' });

    if (action === 'hide') {
      await db.run(`UPDATE community_posts SET is_hidden=1, status='hidden', updated_at=? WHERE id=?`, [nowIso(), id]);
    } else if (action === 'delete') {
      await db.run(`UPDATE community_posts SET is_hidden=1, status='deleted', updated_at=? WHERE id=?`, [nowIso(), id]);
    } else if (action === 'pin') {
      await db.run('UPDATE community_posts SET is_pinned=1, updated_at=? WHERE id=?', [nowIso(), id]);
    } else if (action === 'unpin') {
      await db.run('UPDATE community_posts SET is_pinned=0, updated_at=? WHERE id=?', [nowIso(), id]);
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    await logAdminAction(db, req.authUser.id, `community:post:${action}`, 'post', id);

    const updated = await db.get('SELECT * FROM community_posts WHERE id = ?', [id]);
    res.json({ post: { ...updated, is_hidden: !!updated.is_hidden, is_pinned: !!updated.is_pinned } });
  });

  router.patch('/comments/:id/action', async (req, res) => {
    const id = Number(req.params.id);
    const action = sanitizeText(req.body.action, 20).toLowerCase();

    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    const comment = await db.get('SELECT * FROM community_comments WHERE id = ?', [id]);
    if (!comment) return res.status(404).json({ error: 'Komment topilmadi' });

    if (action === 'hide') {
      await db.run(`UPDATE community_comments SET is_hidden=1, status='hidden', updated_at=? WHERE id=?`, [nowIso(), id]);
    } else if (action === 'delete') {
      await db.run(`UPDATE community_comments SET is_hidden=1, status='deleted', updated_at=? WHERE id=?`, [nowIso(), id]);
    } else if (action === 'unhide') {
      await db.run(`UPDATE community_comments SET is_hidden=0, status='active', updated_at=? WHERE id=?`, [nowIso(), id]);
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    await logAdminAction(db, req.authUser.id, `community:comment:${action}`, 'comment', id);

    const updated = await db.get('SELECT * FROM community_comments WHERE id = ?', [id]);
    res.json({ comment: { ...updated, is_hidden: !!updated.is_hidden } });
  });

  router.patch('/reports/:id/status', async (req, res) => {
    const id = Number(req.params.id);
    const status = isAllowed(sanitizeText(req.body.status, 20).toLowerCase(), ['open', 'in_review', 'resolved', 'dismissed'], 'open');

    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const report = await db.get('SELECT * FROM community_reports WHERE id = ?', [id]);
    if (!report) return res.status(404).json({ error: 'Report topilmadi' });

    const resolvedAt = ['resolved', 'dismissed'].includes(status) ? nowIso() : null;
    const resolvedBy = ['resolved', 'dismissed'].includes(status) ? req.authUser.id : null;

    await db.run(
      `UPDATE community_reports SET status=?, resolved_at=?, resolved_by=? WHERE id=?`,
      [status, resolvedAt, resolvedBy, id]
    );

    await logAdminAction(db, req.authUser.id, 'community:report:status', 'report', id, { status });

    const updated = await db.get('SELECT * FROM community_reports WHERE id = ?', [id]);
    res.json({ report: updated });
  });

  router.post('/warn', async (req, res) => {
    const userId = Number(req.body.user_id);
    const message = sanitizeText(req.body.message, 500);

    if (Number.isNaN(userId) || !message) {
      return res.status(400).json({ error: 'user_id va message kerak' });
    }

    const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User topilmadi' });

    const created = await db.run(
      `INSERT INTO user_warnings (user_id, admin_id, message, created_at)
       VALUES (?, ?, ?, ?)` ,
      [userId, req.authUser.id, message, nowIso()]
    );

    await logAdminAction(db, req.authUser.id, 'community:warn', 'warning', created.lastID, { user_id: userId });
    res.status(201).json({ ok: true, warning_id: created.lastID });
  });

  return router;
}

module.exports = createAdminCommunityRouter;
