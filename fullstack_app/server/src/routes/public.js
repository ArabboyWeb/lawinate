const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createAsyncRouter } = require('../middleware');
const {
  APP_BASE_URL,
  GOOGLE_OAUTH_AUTHORIZE_URL,
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  sanitizeText,
  clampNumber,
  getTodayDate,
  shuffleArray,
  createToken,
  serializeUser,
  serializeResult,
  toBoolean,
  nowIso,
  randomString
} = require('../utils');

const GOOGLE_SCOPE = 'openid email profile';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const DEFAULT_SERVER_BASE_URL = process.env.SERVER_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
const AI_MODELS = [
  {
    id: 'z-ai/glm-4.5-air:free',
    name: 'GLM 4.5 Air',
    vendor: 'Z-AI',
    intelligence_rank: 1
  }
];
const BLOG_CATEGORIES = new Set([
  'jinoyat',
  'fuqarolik',
  'konstitutsiya',
  'mehnat',
  'xalqaro',
  'talim'
]);

function getSortedAiModels() {
  return [...AI_MODELS].sort((a, b) => a.intelligence_rank - b.intelligence_rank);
}

function getModelById(id) {
  return getSortedAiModels().find((model) => model.id === id) || getSortedAiModels()[0];
}

function pickBlogCategory(value) {
  const normalized = sanitizeText(String(value || ''), 40).toLowerCase();
  return BLOG_CATEGORIES.has(normalized) ? normalized : 'talim';
}

function pickBlogStatus(value) {
  return sanitizeText(String(value || ''), 20).toLowerCase() === 'published' ? 'published' : 'draft';
}

function normalizeBlogTags(rawTags) {
  return String(rawTags || '')
    .split(',')
    .map((tag) => sanitizeText(tag, 30).toLowerCase().replace(/\s+/g, '_'))
    .map((tag) => tag.replace(/[^a-z0-9_]/g, ''))
    .filter(Boolean)
    .slice(0, 8);
}

function slugifyTitle(title) {
  const normalized = sanitizeText(String(title || ''), 160)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || `post-${randomString(8).toLowerCase()}`;
}

async function generateUniqueBlogSlug(db, title) {
  const base = slugifyTitle(title).slice(0, 120);
  let slug = base;
  let attempt = 0;

  while (attempt < 20) {
    const exists = await db.get('SELECT id FROM blog_posts WHERE slug = ?', [slug]);
    if (!exists) return slug;
    attempt += 1;
    slug = `${base}-${attempt}-${randomString(4).toLowerCase()}`.slice(0, 160);
  }

  return `${base}-${Date.now()}`.slice(0, 160);
}

function buildBlogLink(slug) {
  return `/blog/${encodeURIComponent(slug)}`;
}

function serializeBlogPost(row, opts = {}) {
  const withContent = !!opts.withContent;
  const tags = normalizeBlogTags(row.tags);
  const link = buildBlogLink(row.slug);

  const payload = {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    tags,
    status: row.status,
    cover_image: row.cover_image || '',
    excerpt: sanitizeText(row.content || '', 260),
    is_auto_generated: !!row.is_auto_generated,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    link,
    absolute_link: new URL(link, APP_BASE_URL).toString(),
    author: {
      id: row.user_id,
      full_name: row.author_name || '',
      profile_image: row.author_profile_image || ''
    }
  };

  if (withContent) {
    payload.content = row.content || '';
  }

  return payload;
}

async function createAutoWelcomeBlogPost(db, user) {
  const title = "Mening birinchi blog postim";
  const slug = await generateUniqueBlogSlug(db, `${title}-${user.id}`);
  const now = nowIso();
  const content = `Assalomu alaykum!\n\nMen ${user.full_name}. Lawinate platformasiga yangi qo'shildim.\n\nBu post avtomatik yaratildi. Yaqin kunlarda huquqiy mavzularda foydali postlar ulashaman.`;

  await db.run(
    `INSERT INTO blog_posts
     (user_id, title, slug, category, tags, content, cover_image, status, is_auto_generated, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'published', 1, ?, ?, ?)` ,
    [
      user.id,
      title,
      slug,
      'talim',
      'lawinate,yangi_user',
      content,
      '',
      now,
      now,
      now
    ]
  );
}

function normalizeConversationMessages(payloadMessages = []) {
  if (!Array.isArray(payloadMessages)) return [];

  return payloadMessages
    .map((item) => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: sanitizeText(item?.text || item?.content || '', 6000)
    }))
    .filter((item) => item.content)
    .slice(-14);
}

async function callOpenRouter(modelId, messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': APP_BASE_URL,
        'X-Title': 'Lawinate AI'
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        max_tokens: 768,
        temperature: 0.35,
        top_p: 0.9,
        stream: false
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = payload?.error?.message || payload?.message || 'OpenRouter error';
      throw new Error(reason);
    }

    const content = payload?.choices?.[0]?.message?.content || '';
    const textResponse = typeof content === 'string'
      ? content
      : Array.isArray(content)
      ? content.map((part) => part?.text || '').join(' ')
      : '';

    return {
      text: sanitizeText(textResponse, 12000),
      tokens: Number(payload?.usage?.total_tokens) || 0
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getGoogleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || `${DEFAULT_SERVER_BASE_URL}/api/auth/google/callback`,
  };
}

function getGoogleFrontendRedirectPath(value, fallback = '/dashboard') {
  const cleaned = sanitizeText(String(value || ''), 200);
  if (!cleaned || !cleaned.startsWith('/') || cleaned.startsWith('//')) {
    return fallback;
  }
  if (cleaned.includes('://')) {
    return fallback;
  }
  return cleaned;
}

async function createGoogleState(db, redirectPath) {
  const state = randomString(48);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await db.run(
    `INSERT INTO oauth_states (state, purpose, redirect_path, created_at, expires_at)
     VALUES (?, 'google_login', ?, ?, ?)` ,
    [state, redirectPath, nowIso(), expiresAt]
  );
  return state;
}

async function consumeGoogleState(db, state) {
  const row = await db.get(
    `SELECT state, redirect_path, expires_at FROM oauth_states
     WHERE state = ? AND purpose = 'google_login'`,
    [state]
  );
  await db.run(`DELETE FROM oauth_states WHERE state = ?`, [state]);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row;
}

function buildGoogleErrorRedirect(path, message) {
  const redirectPath = getGoogleFrontendRedirectPath(path, '/auth');
  const target = new URL(redirectPath, APP_BASE_URL);
  target.searchParams.set('error', message);
  return target.toString();
}

function buildGoogleSuccessRedirect(path, token, user) {
  const redirectPath = getGoogleFrontendRedirectPath(path, '/dashboard');
  const target = new URL(redirectPath, APP_BASE_URL);
  target.searchParams.set('token', token);
  target.searchParams.set('user', Buffer.from(JSON.stringify(serializeUser(user))).toString('base64url'));
  target.searchParams.set('auth_provider', 'google');
  return target.toString();
}

async function fetchGoogleToken(code, config) {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code'
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error('Google token exchange failed');
  }

  return response.json();
}

async function fetchGoogleUserInfo(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Google profile');
  }

  return response.json();
}

async function upsertGoogleUser(db, profile) {
  const email = sanitizeText(profile.email, 120).toLowerCase();
  const fullName = sanitizeText(profile.name || profile.given_name || 'Google User', 120);
  const picture = sanitizeText(profile.picture || '', 500);
  const googleSub = sanitizeText(profile.sub, 120);

  if (!email || !googleSub) {
    throw new Error('Google profile data incomplete');
  }

  let user = await db.get('SELECT * FROM users WHERE google_sub = ?', [googleSub]);
  if (user) {
    await db.run(
      `UPDATE users
       SET email = ?, full_name = ?, profile_image = COALESCE(NULLIF(?, ''), profile_image),
           provider = 'google', email_verified = ?, last_login_at = ?, updated_at = ?
       WHERE id = ?`,
      [email, fullName, picture, profile.email_verified ? 1 : 0, nowIso(), nowIso(), user.id]
    );
    return db.get('SELECT * FROM users WHERE id = ?', [user.id]);
  }

  user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  if (user) {
    await db.run(
      `UPDATE users
       SET google_sub = ?, provider = 'google', email_verified = ?,
           full_name = COALESCE(NULLIF(full_name, ''), ?),
           profile_image = COALESCE(NULLIF(?, ''), profile_image),
           last_login_at = ?, updated_at = ?
       WHERE id = ?`,
      [googleSub, profile.email_verified ? 1 : 0, fullName, picture, nowIso(), nowIso(), user.id]
    );
    return db.get('SELECT * FROM users WHERE id = ?', [user.id]);
  }

  const created = await db.run(
    `INSERT INTO users
      (full_name, email, password_hash, phone, university, course, city, bio, role, provider, google_sub, email_verified, profile_image, registration_date, last_login_at, created_at, updated_at)
     VALUES (?, ?, '', '', '', '', '', '', 'student', 'google', ?, ?, ?, ?, ?, ?, ?)` ,
    [
      fullName,
      email,
      googleSub,
      profile.email_verified ? 1 : 0,
      picture,
      nowIso(),
      nowIso(),
      nowIso(),
      nowIso()
    ]
  );

  const createdUser = await db.get('SELECT * FROM users WHERE id = ?', [created.lastID]);
  try {
    await createAutoWelcomeBlogPost(db, createdUser);
  } catch (_err) {
    // Google login should continue even if auto post fails.
  }
  return createdUser;
}

function createPublicRouter(db, authRequired, checkDatabaseHealth = async () => ({ ok: true })) {
  const router = createAsyncRouter();

  router.get('/health', async (_req, res) => {
    try {
      const dbStatus = await checkDatabaseHealth();
      return res.json({
        status: 'ok',
        service: 'lawinate-api',
        database: dbStatus,
        at: nowIso()
      });
    } catch (err) {
      return res.status(503).json({
        status: 'error',
        service: 'lawinate-api',
        database: {
          ok: false,
          message: sanitizeText(err?.message || 'Database check failed', 200)
        },
        at: nowIso()
      });
    }
  });

  router.get('/auth/google/url', async (req, res) => {
    const config = getGoogleConfig();
    if (!config.clientId || !config.clientSecret) {
      return res.status(503).json({ error: 'Google auth is not configured on server' });
    }

    const redirectPath = getGoogleFrontendRedirectPath(req.query.redirect || '/dashboard', '/dashboard');
    const state = await createGoogleState(db, redirectPath);
    const url = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('scope', GOOGLE_SCOPE);
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'select_account');

    res.json({ url: url.toString() });
  });

  router.get('/auth/google/callback', async (req, res) => {
    const config = getGoogleConfig();
    const state = sanitizeText(req.query.state, 200);
    const code = sanitizeText(req.query.code, 2000);
    const stateRow = await consumeGoogleState(db, state);

    if (!stateRow) {
      return res.redirect(buildGoogleErrorRedirect('/auth', 'Invalid or expired Google state'));
    }

    if (!config.clientId || !config.clientSecret) {
      return res.redirect(buildGoogleErrorRedirect(stateRow.redirect_path, 'Google auth is not configured on server'));
    }

    if (!code) {
      return res.redirect(buildGoogleErrorRedirect(stateRow.redirect_path, 'Google authorization code missing'));
    }

    try {
      const tokenPayload = await fetchGoogleToken(code, config);
      const profile = await fetchGoogleUserInfo(tokenPayload.access_token);
      const user = await upsertGoogleUser(db, profile);

      if (user.is_banned) {
        return res.redirect(buildGoogleErrorRedirect(stateRow.redirect_path, 'Account is banned'));
      }

      await db.run('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?', [nowIso(), nowIso(), user.id]);
      const token = createToken(jwt, user, true);
      return res.redirect(buildGoogleSuccessRedirect(stateRow.redirect_path, token, user));
    } catch (_err) {
      return res.redirect(buildGoogleErrorRedirect(stateRow.redirect_path, 'Google login failed'));
    }
  });

  router.post('/register', async (req, res) => {
    const settings = await db.get('SELECT * FROM site_settings WHERE id = 1');
    if (settings && !settings.allow_registration) {
      return res.status(403).json({ error: 'Registration is disabled' });
    }

    const fullName = sanitizeText(req.body.full_name, 120);
    const email = sanitizeText(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || '');
    const profileImage = sanitizeText(req.body.profile_image, 800000);

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Required fields are missing' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 chars' });
    }

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const created = await db.run(
      `INSERT INTO users
      (full_name, email, password_hash, phone, university, course, city, bio, profile_image, role, registration_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'student', ?, ?, ?)` ,
      [
        fullName,
        email,
        hash,
        sanitizeText(req.body.phone, 40),
        sanitizeText(req.body.university, 180),
        sanitizeText(req.body.course, 60),
        sanitizeText(req.body.city, 80),
        sanitizeText(req.body.bio, 500),
        profileImage,
        nowIso(),
        nowIso(),
        nowIso()
      ]
    );

    const user = await db.get('SELECT * FROM users WHERE id = ?', [created.lastID]);
    try {
      await createAutoWelcomeBlogPost(db, user);
    } catch (_err) {
      // Registration should not fail if auto post creation fails.
    }
    const token = createToken(jwt, user, false);
    return res.json({ token, user: serializeUser(user) });
  });

  router.post('/login', async (req, res) => {
    const email = sanitizeText(req.body.email, 120).toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account uses Google sign-in' });
    }

    let valid = false;
    try {
      valid = await bcrypt.compare(password, user.password_hash);
    } catch (_err) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.is_banned) return res.status(403).json({ error: 'Account is banned' });

    await db.run('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?', [nowIso(), nowIso(), user.id]);
    const token = createToken(jwt, user, false);

    return res.json({ token, user: serializeUser(user) });
  });

  router.get('/profile', authRequired, async (req, res) => {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.authUser.id]);
    res.json({ user: serializeUser(user) });
  });

  router.get('/blog/posts', async (req, res) => {
    const rawCategory = sanitizeText(String(req.query.category || ''), 40).toLowerCase();
    const hasCategory = BLOG_CATEGORIES.has(rawCategory);
    const q = sanitizeText(req.query.q, 120).toLowerCase();
    const limit = clampNumber(req.query.limit, 1, 40, 12);
    const offset = clampNumber(req.query.offset, 0, 2000, 0);

    const where = [`p.status = 'published'`];
    const params = [];

    if (hasCategory) {
      where.push('p.category = ?');
      params.push(rawCategory);
    }

    if (q) {
      where.push(`(
        LOWER(p.title) LIKE ?
        OR LOWER(p.content) LIKE ?
        OR LOWER(COALESCE(p.tags, '')) LIKE ?
        OR LOWER(u.full_name) LIKE ?
      )`);
      const likeQ = `%${q}%`;
      params.push(likeQ, likeQ, likeQ, likeQ);
    }

    const rows = await db.all(
      `SELECT
         p.*,
         u.full_name AS author_name,
         u.profile_image AS author_profile_image
       FROM blog_posts p
       JOIN users u ON u.id = p.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY COALESCE(p.published_at, p.created_at) DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const countRow = await db.get(
      `SELECT COUNT(*) AS total
       FROM blog_posts p
       JOIN users u ON u.id = p.user_id
       WHERE ${where.join(' AND ')}`,
      params
    );

    res.json({
      posts: rows.map((row) => serializeBlogPost(row)),
      total: countRow?.total || 0,
      limit,
      offset
    });
  });

  router.get('/blog/posts/:slug', async (req, res) => {
    const slug = sanitizeText(req.params.slug, 180).toLowerCase();
    if (!slug) {
      return res.status(400).json({ error: 'Invalid blog slug' });
    }

    const row = await db.get(
      `SELECT
         p.*,
         u.full_name AS author_name,
         u.profile_image AS author_profile_image
       FROM blog_posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.slug = ? AND p.status = 'published'
       LIMIT 1`,
      [slug]
    );

    if (!row) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ post: serializeBlogPost(row, { withContent: true }) });
  });

  router.get('/blog/my-posts', authRequired, async (req, res) => {
    const rows = await db.all(
      `SELECT
         p.*,
         u.full_name AS author_name,
         u.profile_image AS author_profile_image
       FROM blog_posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ?
       ORDER BY p.updated_at DESC
       LIMIT 100`,
      [req.authUser.id]
    );

    res.json({
      posts: rows.map((row) => serializeBlogPost(row, { withContent: true }))
    });
  });

  router.post('/blog/posts', authRequired, async (req, res) => {
    const title = sanitizeText(req.body.title, 160);
    const category = pickBlogCategory(req.body.category);
    const tags = normalizeBlogTags(req.body.tags).join(',');
    const content = sanitizeText(req.body.content, 30000);
    const status = pickBlogStatus(req.body.status);
    const coverImage = sanitizeText(req.body.cover_image, 900000);

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const now = nowIso();
    const slug = await generateUniqueBlogSlug(db, title);
    const publishedAt = status === 'published' ? now : null;

    const created = await db.run(
      `INSERT INTO blog_posts
       (user_id, title, slug, category, tags, content, cover_image, status, is_auto_generated, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)` ,
      [
        req.authUser.id,
        title,
        slug,
        category,
        tags,
        content,
        coverImage,
        status,
        publishedAt,
        now,
        now
      ]
    );

    const row = await db.get(
      `SELECT
         p.*,
         u.full_name AS author_name,
         u.profile_image AS author_profile_image
       FROM blog_posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`,
      [created.lastID]
    );

    res.json({
      post: serializeBlogPost(row, { withContent: true }),
      link: buildBlogLink(row.slug),
      absolute_link: new URL(buildBlogLink(row.slug), APP_BASE_URL).toString()
    });
  });

  router.put('/blog/posts/:id', authRequired, async (req, res) => {
    const postId = clampNumber(req.params.id, 1, Number.MAX_SAFE_INTEGER, 0);
    if (!postId) return res.status(400).json({ error: 'Invalid post id' });

    const existing = await db.get('SELECT * FROM blog_posts WHERE id = ? AND user_id = ?', [postId, req.authUser.id]);
    if (!existing) return res.status(404).json({ error: 'Post not found' });

    const title = sanitizeText(req.body.title, 160) || existing.title;
    const category = req.body.category ? pickBlogCategory(req.body.category) : existing.category;
    const tags = req.body.tags !== undefined ? normalizeBlogTags(req.body.tags).join(',') : (existing.tags || '');
    const content = req.body.content !== undefined ? sanitizeText(req.body.content, 30000) : existing.content;
    const status = req.body.status !== undefined ? pickBlogStatus(req.body.status) : existing.status;
    const coverImage = req.body.cover_image !== undefined ? sanitizeText(req.body.cover_image, 900000) : (existing.cover_image || '');
    const now = nowIso();
    const publishedAt = status === 'published'
      ? (existing.published_at || now)
      : null;

    await db.run(
      `UPDATE blog_posts
       SET title = ?, category = ?, tags = ?, content = ?, cover_image = ?, status = ?, published_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [title, category, tags, content, coverImage, status, publishedAt, now, postId, req.authUser.id]
    );

    const row = await db.get(
      `SELECT
         p.*,
         u.full_name AS author_name,
         u.profile_image AS author_profile_image
       FROM blog_posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`,
      [postId]
    );

    res.json({
      post: serializeBlogPost(row, { withContent: true }),
      link: buildBlogLink(row.slug),
      absolute_link: new URL(buildBlogLink(row.slug), APP_BASE_URL).toString()
    });
  });

  router.get('/tests/:category', async (req, res) => {
    const category = sanitizeText(req.params.category, 40).toLowerCase();
    let rows;

    if (category === 'mixed') {
      rows = await db.all(
        `SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d
         FROM questions q
         JOIN tests t ON t.id = q.test_id
         WHERE q.status = 'published' AND t.status = 'published'`
      );
      rows = shuffleArray(rows).slice(0, 10);
    } else {
      rows = await db.all(
        `SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d
         FROM questions q
         JOIN tests t ON t.id = q.test_id
         WHERE t.category = ? AND q.status = 'published' AND t.status = 'published'` ,
        [category]
      );
    }

    res.json({
      category,
      questions: rows.map((row) => ({
        id: String(row.id),
        q: row.question_text,
        a: [row.option_a, row.option_b, row.option_c, row.option_d]
      }))
    });
  });

  router.post('/tests/:category/submit', authRequired, async (req, res) => {
    const category = sanitizeText(req.params.category, 40).toLowerCase();
    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const questionIds = Array.isArray(req.body.question_ids) ? req.body.question_ids : [];

    if (answers.length === 0 || questionIds.length === 0 || answers.length !== questionIds.length) {
      return res.status(400).json({ error: 'Invalid answers or question ids' });
    }

    const deduped = [...new Set(questionIds.map((id) => Number(id)))].filter((id) => !Number.isNaN(id));
    if (deduped.length !== questionIds.length) {
      return res.status(400).json({ error: 'Duplicate question ids are not allowed' });
    }

    const placeholders = deduped.map(() => '?').join(',');
    const rows = await db.all(
      `SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, t.id as test_id, t.category
       FROM questions q
       JOIN tests t ON t.id = q.test_id
       WHERE q.id IN (${placeholders}) AND q.status = 'published' AND t.status = 'published'` ,
      deduped
    );

    if (rows.length !== deduped.length) {
      return res.status(400).json({ error: 'Invalid question ids' });
    }

    const map = rows.reduce((acc, row) => {
      acc[row.id] = row;
      return acc;
    }, {});

    let correct = 0;
    const optionMap = ['A', 'B', 'C', 'D'];
    const testCounter = {};
    const mistakes = [];

    for (let i = 0; i < questionIds.length; i += 1) {
      const qId = Number(questionIds[i]);
      const row = map[qId];
      if (!row) return res.status(400).json({ error: 'Question mismatch' });

      testCounter[row.test_id] = (testCounter[row.test_id] || 0) + 1;
      if (category !== 'mixed' && row.category !== category) {
        return res.status(400).json({ error: 'Category mismatch' });
      }

      const idx = clampNumber(answers[i], 0, 3, -1);
      const selectedOption = optionMap[idx] || null;

      if (selectedOption === row.correct_option) {
        correct += 1;
      } else {
        const optionTexts = {
          A: row.option_a,
          B: row.option_b,
          C: row.option_c,
          D: row.option_d
        };

        mistakes.push({
          question_id: String(row.id),
          question: row.question_text,
          selected_option: selectedOption,
          selected_answer: selectedOption ? optionTexts[selectedOption] : null,
          correct_option: row.correct_option,
          correct_answer: optionTexts[row.correct_option] || '',
          options: [row.option_a, row.option_b, row.option_c, row.option_d]
        });
      }
    }

    const total = questionIds.length;
    const score = Math.round((correct / total) * 100);
    const points = correct * 20;

    const mainTestId = Number(Object.entries(testCounter).sort((a, b) => b[1] - a[1])[0]?.[0]) || null;
    const dominantCategory = category === 'mixed'
      ? (rows.find((r) => r.test_id === mainTestId)?.category || 'mixed')
      : category;

    await db.run(
      `INSERT INTO results (user_id, test_id, category, correct_count, total_questions, score, points_earned, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
      [req.authUser.id, mainTestId, dominantCategory, correct, total, score, points, nowIso()]
    );

    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.authUser.id]);
    const today = getTodayDate();

    let streak = user.streak_days || 0;
    if (!user.last_test_date) {
      streak = 1;
    } else {
      const lastDate = user.last_test_date;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const y = yesterday.toISOString().slice(0, 10);
      if (lastDate === today) streak = user.streak_days || 1;
      else if (lastDate === y) streak = (user.streak_days || 0) + 1;
      else streak = 1;
    }

    await db.run(
      `UPDATE users
       SET total_tests=?, correct_answers=?, total_questions=?, points=?, streak_days=?, last_test_date=?, updated_at=?
       WHERE id=?` ,
      [
        (user.total_tests || 0) + 1,
        (user.correct_answers || 0) + correct,
        (user.total_questions || 0) + total,
        (user.points || 0) + points,
        streak,
        today,
        nowIso(),
        user.id
      ]
    );

    res.json({
      correct,
      total,
      score,
      points_earned: points,
      streak_days: streak,
      mistakes
    });
  });

  router.get('/books', async (req, res) => {
    const category = sanitizeText(req.query.category || '', 60);
    const q = sanitizeText(req.query.q || '', 120).toLowerCase();

    const where = [`status = 'published'`];
    const params = [];

    if (category) {
      where.push('category = ?');
      params.push(category);
    }

    if (q) {
      where.push('(LOWER(title) LIKE ? OR LOWER(author) LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }

    const books = await db.all(
      `SELECT * FROM books WHERE ${where.join(' AND ')} ORDER BY featured DESC, downloads DESC`,
      params
    );

    res.json({
      books: books.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        category: book.category,
        downloads: `${book.downloads}`,
        icon: 'BOOK',
        gradient: 'from-blue-600/20 to-blue-900/40',
        link: book.file_url || book.link || '',
        cover_url: book.cover_url,
        featured: !!book.featured
      }))
    });
  });

  router.get('/ranking', async (_req, res) => {
    const users = await db.all(
      `SELECT id, full_name, city, total_tests, correct_answers, total_questions, points
       FROM users
       WHERE role='student' AND total_tests > 0
       ORDER BY points DESC
       LIMIT 100`
    );

    const ranking = users.map((u, idx) => {
      const totalQuestions = u.total_questions || 0;
      const accuracy = totalQuestions > 0
        ? Math.round((u.correct_answers / totalQuestions) * 1000) / 10
        : 0;

      return {
        rank: idx + 1,
        name: u.full_name,
        city: u.city,
        tests: u.total_tests,
        accuracy,
        points: u.points
      };
    });

    res.json({ ranking });
  });

  router.get('/history', authRequired, async (req, res) => {
    const rows = await db.all(
      `SELECT * FROM results WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [req.authUser.id]
    );
    res.json({ history: rows.map(serializeResult) });
  });

  router.get('/ai/models', authRequired, (_req, res) => {
    const models = getSortedAiModels().map((model) => ({
      id: model.id,
      name: model.name,
      vendor: model.vendor,
      intelligence_rank: model.intelligence_rank
    }));
    res.json({ models });
  });

  router.post('/ai', authRequired, async (req, res) => {
    const prompt = sanitizeText(req.body.prompt, 6000);
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    if (!OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'AI provider key is missing' });
    }

    const model = getModelById(sanitizeText(req.body.model, 200));
    const settings = await db.get('SELECT * FROM ai_settings WHERE id = 1');
    const limit = settings?.rate_limit_per_minute || 30;

    const countRow = await db.get(
      `SELECT COUNT(*) as count FROM ai_prompt_logs
       WHERE user_id = ? AND created_at >= datetime('now', '-1 minute')`,
      [req.authUser.id]
    );

    if ((countRow.count || 0) >= limit) {
      return res.status(429).json({ error: 'Rate limit exceeded, please try later' });
    }

    const userMessages = normalizeConversationMessages(req.body.messages);
    const history = userMessages.length > 0
      ? userMessages
      : [{ role: 'user', content: prompt }];

    const messages = [
      {
        role: 'system',
        content: 'You are an expert legal study assistant. Respond clearly, accurately, and in Uzbek when user writes Uzbek.'
      },
      ...history
    ];

    let aiResult = null;
    let usedModel = model;

    try {
      aiResult = await callOpenRouter(model.id, messages);
    } catch (err) {
      return res.status(502).json({ error: `AI provider error: ${sanitizeText(err?.message || 'Unknown error', 300)}` });
    }

    const responseText = aiResult.text || 'AI javob bera olmadi, iltimos qayta urinib ko‘ring.';
    const tokens = aiResult.tokens || Math.max(1, Math.ceil((prompt.length + responseText.length) / 4));

    await db.run(
      `INSERT INTO ai_prompt_logs (user_id, prompt, response, model_name, tokens_used, safe_flag, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [req.authUser.id, prompt, responseText, usedModel.id, tokens, toBoolean(settings?.safe_mode_enabled) ? 1 : 0, nowIso()]
    );

    res.json({
      prompt,
      response: responseText,
      model: usedModel.id,
      model_name: usedModel.name,
      intelligence_rank: usedModel.intelligence_rank,
      tokens_used: tokens,
      fallback_used: false
    });
  });

  return router;
}

module.exports = createPublicRouter;
