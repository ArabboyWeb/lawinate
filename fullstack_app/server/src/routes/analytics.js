const { createAsyncRouter } = require('../middleware');
const { nowIso, randomString, sanitizeText } = require('../utils');

function normalizeIdentifier(value, fallbackPrefix) {
  const cleaned = sanitizeText(String(value || ''), 120).replace(/[^a-zA-Z0-9._:-]/g, '');
  return cleaned || `${fallbackPrefix}_${randomString(18).toLowerCase()}`;
}

function normalizeEventName(value) {
  const cleaned = sanitizeText(String(value || ''), 60)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return cleaned || 'page_view';
}

function normalizePath(value) {
  const cleaned = sanitizeText(String(value || ''), 500);
  return cleaned || '/';
}

function normalizeMeta(value, depth = 0) {
  if (depth > 3) return undefined;

  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return sanitizeText(value, 400);
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value) : undefined;
  if (typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => normalizeMeta(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .slice(0, 20)
      .reduce((acc, key) => {
        const normalized = normalizeMeta(value[key], depth + 1);
        if (normalized !== undefined) {
          acc[sanitizeText(key, 60)] = normalized;
        }
        return acc;
      }, {});
  }

  return undefined;
}

function serializeMeta(value) {
  const normalized = normalizeMeta(value) || {};
  const json = JSON.stringify(normalized);
  if (json.length <= 5000) return json;
  return JSON.stringify({ truncated: true });
}

function detectDeviceType(userAgent) {
  const ua = String(userAgent || '').toLowerCase();
  if (/bot|crawler|spider|preview/.test(ua)) return 'bot';
  if (/ipad|tablet|sm-t|kindle|silk/.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android/.test(ua)) return 'mobile';
  return 'desktop';
}

function detectBrowser(userAgent) {
  const ua = String(userAgent || '').toLowerCase();
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
  if (ua.includes('firefox/')) return 'Firefox';
  if (ua.includes('chrome/') && !ua.includes('edg/') && !ua.includes('opr/')) return 'Chrome';
  if (ua.includes('safari/') && !ua.includes('chrome/')) return 'Safari';
  if (ua.includes('trident/') || ua.includes('msie')) return 'Internet Explorer';
  return 'Other';
}

function detectOs(userAgent) {
  const ua = String(userAgent || '').toLowerCase();
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'iOS';
  if (ua.includes('mac os x') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';
  return 'Other';
}

function createAnalyticsRouter(db, optionalAuth) {
  const router = createAsyncRouter();

  router.post('/track', optionalAuth, async (req, res) => {
    const userAgent = req.headers['user-agent'] || '';
    const eventName = normalizeEventName(req.body.event_name);
    const visitorId = normalizeIdentifier(req.body.visitor_id, 'anon');
    const sessionId = normalizeIdentifier(req.body.session_id, 'sess');
    const path = normalizePath(req.body.path);
    const pageTitle = sanitizeText(req.body.page_title, 180);
    const referrer = sanitizeText(req.body.referrer, 1000);
    const source = sanitizeText(req.body.source, 120);
    const medium = sanitizeText(req.body.medium, 120);
    const campaign = sanitizeText(req.body.campaign, 160);
    const term = sanitizeText(req.body.term, 160);
    const content = sanitizeText(req.body.content, 160);
    const metaJson = serializeMeta(req.body.meta);

    await db.run(
      `INSERT INTO analytics_events
       (user_id, visitor_id, session_id, event_name, path, page_title, referrer, source, medium, campaign, term, content, device_type, browser, os, meta_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.authUser?.id || null,
        visitorId,
        sessionId,
        eventName,
        path,
        pageTitle,
        referrer,
        source,
        medium,
        campaign,
        term,
        content,
        detectDeviceType(userAgent),
        detectBrowser(userAgent),
        detectOs(userAgent),
        metaJson,
        nowIso()
      ]
    );

    res.status(202).json({ ok: true });
  });

  return router;
}

module.exports = createAnalyticsRouter;
