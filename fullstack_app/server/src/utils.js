const { randomBytes } = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const ADMIN_ROLES = ['admin', 'moderator'];
const TEST_STATUSES = ['draft', 'published', 'unpublished'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.CLIENT_URL || 'https://example.com';
const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

function nowIso() {
  return new Date().toISOString();
}

function randomString(size = 32) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(Math.max(1, size));
  let out = '';

  for (let i = 0; i < size; i += 1) {
    out += chars[bytes[i] % chars.length];
  }

  return out;
}

function normalizeOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    return new URL(raw).origin;
  } catch (_err) {
    return '';
  }
}

function getConfiguredFrontendOrigins() {
  const values = [
    process.env.APP_BASE_URL,
    process.env.CLIENT_URL,
    ...(process.env.CORS_ORIGIN || '').split(',')
  ];

  return [...new Set(values.map((value) => normalizeOrigin(value)).filter(Boolean))];
}

function getConfiguredFrontendOriginRegexes() {
  return String(process.env.CORS_ORIGIN_REGEX || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        return [new RegExp(value)];
      } catch (_err) {
        return [];
      }
    });
}

function isAllowedFrontendOrigin(value) {
  const origin = normalizeOrigin(value);
  if (!origin) return false;

  const exactOrigins = getConfiguredFrontendOrigins();
  if (exactOrigins.includes(origin)) {
    return true;
  }

  return getConfiguredFrontendOriginRegexes().some((pattern) => pattern.test(origin));
}

function resolveFrontendBaseUrl(value) {
  if (isAllowedFrontendOrigin(value)) {
    return normalizeOrigin(value);
  }

  return normalizeOrigin(APP_BASE_URL) || 'https://example.com';
}

function sanitizeText(value, maxLength = 2000) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeMultilineText(value, maxLength = 2000) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizePayload(value, maxLength = 1000000) {
  if (Array.isArray(value)) return value.map((item) => sanitizePayload(item, maxLength));
  if (value && typeof value === 'object') {
    return Object.keys(value).reduce((acc, key) => {
      acc[key] = sanitizePayload(value[key], maxLength);
      return acc;
    }, {});
  }
  if (typeof value === 'string') return sanitizeMultilineText(value, maxLength);
  return value;
}

function toBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function clampNumber(value, min, max, fallback = min) {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function isAllowed(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function pickRole(role, fallback = 'student') {
  return isAllowed(role, ['student', 'moderator', 'admin'], fallback);
}

function pickStatus(status, fallback = 'draft') {
  return isAllowed(status, TEST_STATUSES, fallback);
}

function pickDifficulty(level, fallback = 'medium') {
  return isAllowed(level, DIFFICULTIES, fallback);
}

function pickCorrectOption(value) {
  const option = String(value || '').toUpperCase();
  return ['A', 'B', 'C', 'D'].includes(option) ? option : 'A';
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function shuffleArray(arr) {
  const clone = [...arr];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function createToken(jwt, user, remember = false) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      provider: user.provider || 'local'
    },
    JWT_SECRET,
    { expiresIn: remember ? '30d' : '8h' }
  );
}

function serializeUser(user) {
  const totalQuestions = user.total_questions || 0;
  const accuracy = totalQuestions > 0
    ? Math.round((user.correct_answers / totalQuestions) * 1000) / 10
    : 0;

  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    university: user.university,
    course: user.course,
    city: user.city,
    bio: user.bio,
    profile_image: user.profile_image,
    provider: user.provider || 'local',
    email_verified: !!user.email_verified,
    role: user.role,
    is_banned: !!user.is_banned,
    registration_date: user.registration_date,
    points: user.points || 0,
    total_tests: user.total_tests || 0,
    correct_answers: user.correct_answers || 0,
    total_questions: totalQuestions,
    streak_days: user.streak_days || 0,
    accuracy,
    last_login_at: user.last_login_at
  };
}

function serializeResult(row) {
  return {
    id: row.id,
    test_id: row.test_id,
    category: row.category,
    correct: row.correct_count,
    total: row.total_questions,
    score: row.score,
    points: row.points_earned,
    date: row.created_at
  };
}

function serializeBook(row) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    category: row.category,
    file_url: row.file_url,
    cover_url: row.cover_url,
    downloads: row.downloads,
    featured: !!row.featured,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function escapeCsv(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCsvLine(line) {
  const values = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  values.push(cur);
  return values;
}

function parseCsv(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce((acc, header, idx) => {
      acc[header] = cells[idx] ?? '';
      return acc;
    }, {});
  });
}

function dateRange(days = 7) {
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

module.exports = {
  JWT_SECRET,
  ADMIN_ROLES,
  TEST_STATUSES,
  DIFFICULTIES,
  APP_BASE_URL,
  GOOGLE_OAUTH_AUTHORIZE_URL,
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  nowIso,
  randomString,
  normalizeOrigin,
  sanitizeText,
  sanitizeMultilineText,
  sanitizePayload,
  toBoolean,
  clampNumber,
  isAllowed,
  getConfiguredFrontendOrigins,
  getConfiguredFrontendOriginRegexes,
  isAllowedFrontendOrigin,
  pickRole,
  pickStatus,
  pickDifficulty,
  pickCorrectOption,
  getTodayDate,
  resolveFrontendBaseUrl,
  shuffleArray,
  createToken,
  serializeUser,
  serializeResult,
  serializeBook,
  escapeCsv,
  parseCsv,
  dateRange
};
