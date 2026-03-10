const { dateRange } = require('../utils');
const { createAsyncRouter } = require('../middleware');

function createAdminDashboardRouter(db) {
  const router = createAsyncRouter();

  function safeParseMeta(jsonText) {
    if (!jsonText) return {};
    try {
      return JSON.parse(jsonText);
    } catch (_err) {
      return { raw: String(jsonText) };
    }
  }

  router.get('/overview', async (_req, res) => {
    const last7Days = dateRange(7);
    const today = last7Days[last7Days.length - 1];
    const fromDay = last7Days[0];

    const totalUsers = await db.get(`SELECT COUNT(*) as count FROM users WHERE role = 'student'`);
    const todayTests = await db.get(`SELECT COUNT(*) as count FROM results WHERE DATE(created_at) = ?`, [today]);
    const avgAccuracy = await db.get(`SELECT AVG(score) as value FROM results`);
    const totalDownloads = await db.get(`SELECT COALESCE(SUM(downloads), 0) as value FROM books`);

    const dauRows = await db.all(`
      SELECT day, COUNT(DISTINCT user_id) as users
      FROM (
        SELECT DATE(created_at) as day, user_id FROM results
        UNION ALL
        SELECT DATE(created_at) as day, user_id FROM community_posts
        UNION ALL
        SELECT DATE(created_at) as day, user_id FROM ai_prompt_logs
      ) activity
      WHERE day >= ?
      GROUP BY day
      ORDER BY day ASC
    `, [fromDay]);

    const template = last7Days.reduce((acc, day) => {
      acc[day] = 0;
      return acc;
    }, {});

    dauRows.forEach((row) => {
      template[row.day] = row.users;
    });

    const testsByCategory = await db.all(`
      SELECT category, COUNT(*) as count
      FROM results
      GROUP BY category
      ORDER BY count DESC
    `);

    const recent = await db.all(`
      SELECT l.id, l.action, l.entity_type, l.entity_id, l.meta_json, l.created_at,
             u.full_name as admin_name, u.email as admin_email
      FROM admin_activity_logs l
      LEFT JOIN users u ON u.id = l.admin_id
      ORDER BY l.created_at DESC
      LIMIT 20
    `);

    res.json({
      kpi: {
        total_users: totalUsers.count || 0,
        todays_tests: todayTests.count || 0,
        avg_accuracy: Math.round((avgAccuracy.value || 0) * 10) / 10,
        total_downloads: totalDownloads.value || 0
      },
      charts: {
        daily_active_users: Object.entries(template).map(([day, users]) => ({ day, users })),
        tests_by_category: testsByCategory.map((item) => ({ category: item.category, count: item.count }))
      },
      recent_activity: recent.map((item) => ({
        id: item.id,
        action: item.action,
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        admin_name: item.admin_name,
        admin_email: item.admin_email,
        created_at: item.created_at,
        meta: safeParseMeta(item.meta_json)
      }))
    });
  });

  return router;
}

module.exports = createAdminDashboardRouter;
