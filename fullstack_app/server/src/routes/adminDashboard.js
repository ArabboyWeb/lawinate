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

    const trafficSummary = await db.get(`
      SELECT
        COUNT(*) as tracked_events,
        COALESCE(SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END), 0) as page_views,
        COUNT(DISTINCT CASE
          WHEN COALESCE(CAST(user_id AS TEXT), visitor_id, '') <> ''
          THEN COALESCE(CAST(user_id AS TEXT), visitor_id)
          ELSE NULL
        END) as unique_visitors,
        COUNT(DISTINCT CASE
          WHEN COALESCE(session_id, '') <> ''
          THEN session_id
          ELSE NULL
        END) as sessions
      FROM analytics_events
      WHERE DATE(created_at) >= ?
    `, [fromDay]);

    const trafficRows = await db.all(`
      SELECT
        DATE(created_at) as day,
        COALESCE(SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END), 0) as page_views,
        COUNT(DISTINCT CASE
          WHEN COALESCE(CAST(user_id AS TEXT), visitor_id, '') <> ''
          THEN COALESCE(CAST(user_id AS TEXT), visitor_id)
          ELSE NULL
        END) as visitors,
        COUNT(DISTINCT CASE
          WHEN COALESCE(session_id, '') <> ''
          THEN session_id
          ELSE NULL
        END) as sessions
      FROM analytics_events
      WHERE DATE(created_at) >= ?
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `, [fromDay]);

    const trafficTemplate = last7Days.reduce((acc, day) => {
      acc[day] = { day, page_views: 0, visitors: 0, sessions: 0 };
      return acc;
    }, {});

    trafficRows.forEach((row) => {
      trafficTemplate[row.day] = {
        day: row.day,
        page_views: row.page_views || 0,
        visitors: row.visitors || 0,
        sessions: row.sessions || 0
      };
    });

    const topPages = await db.all(`
      SELECT
        path,
        COUNT(*) as views,
        COUNT(DISTINCT CASE
          WHEN COALESCE(CAST(user_id AS TEXT), visitor_id, '') <> ''
          THEN COALESCE(CAST(user_id AS TEXT), visitor_id)
          ELSE NULL
        END) as visitors
      FROM analytics_events
      WHERE event_name = 'page_view' AND DATE(created_at) >= ?
      GROUP BY path
      ORDER BY views DESC, visitors DESC, path ASC
      LIMIT 8
    `, [fromDay]);

    const topSources = await db.all(`
      SELECT
        CASE
          WHEN source IS NULL OR TRIM(source) = '' THEN 'direct'
          ELSE source
        END as source_name,
        CASE
          WHEN medium IS NULL OR TRIM(medium) = '' THEN '(none)'
          ELSE medium
        END as medium_name,
        COUNT(*) as visits
      FROM analytics_events
      WHERE event_name = 'page_view' AND DATE(created_at) >= ?
      GROUP BY
        CASE
          WHEN source IS NULL OR TRIM(source) = '' THEN 'direct'
          ELSE source
        END,
        CASE
          WHEN medium IS NULL OR TRIM(medium) = '' THEN '(none)'
          ELSE medium
        END
      ORDER BY visits DESC, source_name ASC, medium_name ASC
      LIMIT 8
    `, [fromDay]);

    const topReferrers = await db.all(`
      SELECT referrer, COUNT(*) as views
      FROM analytics_events
      WHERE event_name = 'page_view'
        AND DATE(created_at) >= ?
        AND referrer IS NOT NULL
        AND TRIM(referrer) <> ''
      GROUP BY referrer
      ORDER BY views DESC, referrer ASC
      LIMIT 8
    `, [fromDay]);

    const topEvents = await db.all(`
      SELECT event_name, COUNT(*) as count
      FROM analytics_events
      WHERE event_name <> 'page_view' AND DATE(created_at) >= ?
      GROUP BY event_name
      ORDER BY count DESC, event_name ASC
      LIMIT 8
    `, [fromDay]);

    const recentTraffic = await db.all(`
      SELECT event_name, path, source, medium, referrer, created_at
      FROM analytics_events
      ORDER BY created_at DESC
      LIMIT 12
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
      traffic: {
        kpi: {
          unique_visitors: trafficSummary?.unique_visitors || 0,
          page_views: trafficSummary?.page_views || 0,
          sessions: trafficSummary?.sessions || 0,
          tracked_events: trafficSummary?.tracked_events || 0
        },
        charts: {
          daily: Object.values(trafficTemplate),
          top_pages: topPages.map((item) => ({
            path: item.path,
            views: item.views || 0,
            visitors: item.visitors || 0
          })),
          top_sources: topSources.map((item) => ({
            source: item.source_name,
            medium: item.medium_name,
            label: `${item.source_name} / ${item.medium_name}`,
            visits: item.visits || 0
          })),
          top_referrers: topReferrers.map((item) => ({
            referrer: item.referrer,
            views: item.views || 0
          })),
          top_events: topEvents.map((item) => ({
            event_name: item.event_name,
            count: item.count || 0
          }))
        },
        recent_events: recentTraffic.map((item) => ({
          event_name: item.event_name,
          path: item.path,
          source: item.source || 'direct',
          medium: item.medium || '(none)',
          referrer: item.referrer || '',
          created_at: item.created_at
        }))
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
