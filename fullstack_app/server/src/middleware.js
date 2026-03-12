const express = require('express');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, ADMIN_ROLES, sanitizePayload } = require('./utils');

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function wrapRouteLayer(layer) {
  if (Array.isArray(layer)) {
    return layer.map((item) => wrapRouteLayer(item));
  }

  if (typeof layer !== 'function' || layer.length === 4) {
    return layer;
  }

  return (req, res, next) => {
    try {
      const result = layer(req, res, next);
      if (result && typeof result.then === 'function') {
        result.catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

function createAsyncRouter() {
  const router = express.Router();
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all'];

  methods.forEach((method) => {
    const original = router[method].bind(router);
    router[method] = (...layers) => original(...layers.map((layer) => wrapRouteLayer(layer)));
  });

  return router;
}

function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizePayload(req.body);
  }
  next();
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

function createAuth(db, opts = {}) {
  const { adminOnly = false, roles = [] } = opts;

  return asyncHandler(async (req, res, next) => {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Token required' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (_err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', [payload.id]);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.is_banned) return res.status(403).json({ error: 'Account is banned' });

    if (adminOnly && !ADMIN_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    if (roles.length > 0 && !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient role' });
    }

    req.authUser = user;
    next();
  });
}

function createOptionalAuth(db) {
  return asyncHandler(async (req, _res, next) => {
    const token = getBearerToken(req);
    if (!token) {
      next();
      return;
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await db.get('SELECT * FROM users WHERE id = ?', [payload.id]);
      if (user && !user.is_banned) {
        req.authUser = user;
      }
    } catch (_err) {
      // Ignore invalid tokens on public endpoints.
    }

    next();
  });
}

function errorHandler(err, _req, res, _next) {
  console.error('[API ERROR]', err);
  const msg = typeof err?.message === 'string' ? err.message : 'Server error';
  res.status(500).json({ error: msg });
}

module.exports = {
  asyncHandler,
  createAsyncRouter,
  sanitizeBody,
  createAuth,
  createOptionalAuth,
  errorHandler
};
