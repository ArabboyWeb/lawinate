const { createAsyncRouter } = require('../middleware');
const { sanitizeText, clampNumber, toBoolean, nowIso } = require('../utils');
const { logAdminAction } = require('../db');

function createAdminAIRouter(db) {
  const router = createAsyncRouter();

  router.get('/logs', async (req, res) => {
    const search = sanitizeText(req.query.search || '', 120).toLowerCase();

    const where = ['1 = 1'];
    const params = [];

    if (search) {
      where.push('(LOWER(l.prompt) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.full_name) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const logs = await db.all(
      `SELECT l.*, u.full_name as user_name, u.email as user_email
       FROM ai_prompt_logs l
       LEFT JOIN users u ON u.id = l.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY l.created_at DESC
       LIMIT 500`,
      params
    );

    res.json({ logs: logs.map((l) => ({ ...l, safe_flag: !!l.safe_flag })) });
  });

  router.get('/settings', async (_req, res) => {
    const settings = await db.get('SELECT * FROM ai_settings WHERE id = 1');
    res.json({
      settings: {
        rate_limit_per_minute: settings?.rate_limit_per_minute || 30,
        safe_mode_enabled: !!settings?.safe_mode_enabled,
        updated_at: settings?.updated_at
      }
    });
  });

  router.put('/settings', async (req, res) => {
    const rateLimit = clampNumber(req.body.rate_limit_per_minute, 1, 1000, 30);
    const safeMode = toBoolean(req.body.safe_mode_enabled) ? 1 : 0;

    await db.run(
      `UPDATE ai_settings SET rate_limit_per_minute=?, safe_mode_enabled=?, updated_at=? WHERE id=1`,
      [rateLimit, safeMode, nowIso()]
    );

    await logAdminAction(db, req.authUser.id, 'ai:settings:update', 'ai_settings', 1, {
      rate_limit_per_minute: rateLimit,
      safe_mode_enabled: !!safeMode
    });

    const settings = await db.get('SELECT * FROM ai_settings WHERE id = 1');
    res.json({
      settings: {
        rate_limit_per_minute: settings.rate_limit_per_minute,
        safe_mode_enabled: !!settings.safe_mode_enabled,
        updated_at: settings.updated_at
      }
    });
  });

  router.get('/faqs', async (_req, res) => {
    const faqs = await db.all('SELECT * FROM faq_templates ORDER BY updated_at DESC');
    res.json({ faqs: faqs.map((f) => ({ ...f, is_active: !!f.is_active })) });
  });

  router.post('/faqs', async (req, res) => {
    const title = sanitizeText(req.body.title, 150);
    const questionTemplate = sanitizeText(req.body.question_template, 600);
    const answerTemplate = sanitizeText(req.body.answer_template, 2000);
    const isActive = toBoolean(req.body.is_active) ? 1 : 0;

    if (!title || !questionTemplate || !answerTemplate) {
      return res.status(400).json({ error: 'title, question_template, answer_template kerak' });
    }

    const created = await db.run(
      `INSERT INTO faq_templates (title, question_template, answer_template, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?)` ,
      [title, questionTemplate, answerTemplate, isActive, nowIso()]
    );

    await logAdminAction(db, req.authUser.id, 'ai:faq:create', 'faq', created.lastID, { title });

    const faq = await db.get('SELECT * FROM faq_templates WHERE id = ?', [created.lastID]);
    res.status(201).json({ faq: { ...faq, is_active: !!faq.is_active } });
  });

  router.put('/faqs/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await db.get('SELECT * FROM faq_templates WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'FAQ topilmadi' });

    const title = sanitizeText(req.body.title || existing.title, 150);
    const questionTemplate = sanitizeText(req.body.question_template || existing.question_template, 600);
    const answerTemplate = sanitizeText(req.body.answer_template || existing.answer_template, 2000);
    const isActive = req.body.is_active === undefined ? existing.is_active : (toBoolean(req.body.is_active) ? 1 : 0);

    await db.run(
      `UPDATE faq_templates
       SET title=?, question_template=?, answer_template=?, is_active=?, updated_at=?
       WHERE id=?`,
      [title, questionTemplate, answerTemplate, isActive, nowIso(), id]
    );

    await logAdminAction(db, req.authUser.id, 'ai:faq:update', 'faq', id, { title });

    const faq = await db.get('SELECT * FROM faq_templates WHERE id = ?', [id]);
    res.json({ faq: { ...faq, is_active: !!faq.is_active } });
  });

  router.delete('/faqs/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const existing = await db.get('SELECT * FROM faq_templates WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'FAQ topilmadi' });

    await db.run('DELETE FROM faq_templates WHERE id = ?', [id]);
    await logAdminAction(db, req.authUser.id, 'ai:faq:delete', 'faq', id, { title: existing.title });

    res.json({ ok: true });
  });

  return router;
}

module.exports = createAdminAIRouter;
