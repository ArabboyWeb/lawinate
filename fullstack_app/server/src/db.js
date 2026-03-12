const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const { types } = require('pg');
const { getPostgresPool } = require('./pg');
const { nowIso, clampNumber, getTodayDate } = require('./utils');

const INT8_OID = 20;
const NUMERIC_OID = 1700;

types.setTypeParser(INT8_OID, (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
});
types.setTypeParser(NUMERIC_OID, (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
});

const DB_FILE = process.env.SQLITE_DB_FILE
  ? path.resolve(process.env.SQLITE_DB_FILE)
  : path.join(__dirname, '..', 'database.db');
const ADMIN_SEED_EMAIL = process.env.ADMIN_SEED_EMAIL || 'admin@lawinate.local';
const ADMIN_SEED_PASSWORD = process.env.ADMIN_SEED_PASSWORD || 'ChangeMe123!';
const MODERATOR_SEED_EMAIL = process.env.MODERATOR_SEED_EMAIL || 'moderator@lawinate.uz';
const MODERATOR_SEED_PASSWORD = process.env.MODERATOR_SEED_PASSWORD || 'Moderator123$';
const STUDENT_SEED_PASSWORD = process.env.STUDENT_SEED_PASSWORD || 'Student123$';

function resolveDbClient() {
  const explicit = String(process.env.DB_CLIENT || '').trim().toLowerCase();
  if (explicit === 'sqlite' || explicit === 'postgres') return explicit;
  return process.env.DATABASE_URL ? 'postgres' : 'sqlite';
}

function isValidIdentifier(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(value || ''));
}

function splitSqlStatements(sql) {
  const out = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "'" && !inDouble) {
      current += ch;
      if (inSingle && next === "'") {
        current += next;
        i += 1;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (ch === ';' && !inSingle && !inDouble) {
      const trimmed = current.trim();
      if (trimmed) out.push(trimmed);
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) out.push(tail);
  return out;
}

function convertPlaceholders(sql) {
  let idx = 0;
  let out = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "'" && !inDouble) {
      out += ch;
      if (inSingle && next === "'") {
        out += next;
        i += 1;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      out += ch;
      continue;
    }

    if (ch === '?' && !inSingle && !inDouble) {
      idx += 1;
      out += `$${idx}`;
      continue;
    }

    out += ch;
  }

  return out;
}

function toPostgresSchema(sql) {
  let converted = String(sql || '');
  converted = converted.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'BIGSERIAL PRIMARY KEY');
  converted = converted.replace(/registration_date TEXT DEFAULT CURRENT_TIMESTAMP/gi, 'registration_date TIMESTAMPTZ DEFAULT NOW()');
  converted = converted.replace(/last_login_at TEXT/gi, 'last_login_at TIMESTAMPTZ');
  converted = converted.replace(/created_at TEXT DEFAULT CURRENT_TIMESTAMP/gi, 'created_at TIMESTAMPTZ DEFAULT NOW()');
  converted = converted.replace(/updated_at TEXT DEFAULT CURRENT_TIMESTAMP/gi, 'updated_at TIMESTAMPTZ DEFAULT NOW()');
  converted = converted.replace(/published_at TEXT/gi, 'published_at TIMESTAMPTZ');
  converted = converted.replace(/resolved_at TEXT/gi, 'resolved_at TIMESTAMPTZ');
  converted = converted.replace(/expires_at TEXT/gi, 'expires_at TIMESTAMPTZ');
  converted = converted.replace(/joined_at TEXT DEFAULT CURRENT_TIMESTAMP/gi, 'joined_at TIMESTAMPTZ DEFAULT NOW()');
  return converted;
}

function getSchemaSql(client) {
  const base = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone TEXT,
      university TEXT,
      course TEXT,
      city TEXT,
      bio TEXT,
      profile_image TEXT,
      provider TEXT NOT NULL DEFAULT 'local',
      google_sub TEXT UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','moderator','admin')),
      is_banned INTEGER NOT NULL DEFAULT 0,
      points INTEGER NOT NULL DEFAULT 0,
      total_tests INTEGER NOT NULL DEFAULT 0,
      correct_answers INTEGER NOT NULL DEFAULT 0,
      total_questions INTEGER NOT NULL DEFAULT 0,
      streak_days INTEGER NOT NULL DEFAULT 0,
      last_test_date TEXT,
      registration_date TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      difficulty TEXT NOT NULL DEFAULT 'medium' CHECK(difficulty IN ('easy','medium','hard')),
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','unpublished')),
      created_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_option TEXT NOT NULL CHECK(correct_option IN ('A','B','C','D')),
      explanation TEXT,
      status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','unpublished')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(test_id) REFERENCES tests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      test_id INTEGER,
      category TEXT NOT NULL,
      correct_count INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      score INTEGER NOT NULL,
      points_earned INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(test_id) REFERENCES tests(id)
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      category TEXT NOT NULL,
      file_url TEXT,
      cover_url TEXT,
      downloads INTEGER NOT NULL DEFAULT 0,
      featured INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','archived')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS community_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','hidden','deleted')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS community_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','hidden','deleted')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS community_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER,
      item_type TEXT NOT NULL CHECK(item_type IN ('post','comment')),
      item_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_review','resolved','dismissed')),
      resolved_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT,
      FOREIGN KEY(reporter_id) REFERENCES users(id),
      FOREIGN KEY(resolved_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS user_warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      admin_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(admin_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ai_prompt_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      prompt TEXT NOT NULL,
      response TEXT,
      model_name TEXT,
      tokens_used INTEGER NOT NULL DEFAULT 0,
      safe_flag INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ai_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      rate_limit_per_minute INTEGER NOT NULL DEFAULT 30,
      safe_mode_enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS faq_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      question_template TEXT NOT NULL,
      answer_template TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      site_name TEXT NOT NULL DEFAULT 'Lawinate.uz',
      maintenance_mode INTEGER NOT NULL DEFAULT 0,
      allow_registration INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      meta_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(admin_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      request_ip TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chat_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS chat_group_members (
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','member')),
      joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(group_id, user_id),
      FOREIGN KEY(group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      message_text TEXT,
      message_type TEXT NOT NULL DEFAULT 'text' CHECK(message_type IN ('text','voice')),
      voice_blob_base64 TEXT,
      voice_mime_type TEXT,
      voice_duration_sec REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      tags TEXT,
      content TEXT NOT NULL,
      cover_image TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
      is_auto_generated INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      visitor_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      path TEXT NOT NULL,
      page_title TEXT,
      referrer TEXT,
      source TEXT,
      medium TEXT,
      campaign TEXT,
      term TEXT,
      content TEXT,
      device_type TEXT,
      browser TEXT,
      os TEXT,
      meta_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
      ON analytics_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name
      ON analytics_events(event_name);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_path
      ON analytics_events(path);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_id
      ON analytics_events(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id
      ON analytics_events(session_id);
  `;

  if (client === 'postgres') {
    return toPostgresSchema(base);
  }
  return `PRAGMA foreign_keys = ON;\n${base}`;
}

function openDb(filename = DB_FILE) {
  return new Promise((resolve, reject) => {
    const rawDb = new sqlite3.Database(filename, (err) => {
      if (err) return reject(err);
      return resolve(wrapDb(rawDb));
    });
  });
}

function wrapDb(rawDb) {
  return {
    meta: { driver: 'sqlite' },
    exec(sql) {
      return new Promise((resolve, reject) => {
        rawDb.exec(sql, (err) => (err ? reject(err) : resolve()));
      });
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        rawDb.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
      });
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        rawDb.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
      });
    },
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        rawDb.run(sql, params, function runCb(err) {
          if (err) return reject(err);
          return resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    prepare(sql) {
      return new Promise((resolve, reject) => {
        const stmt = rawDb.prepare(sql, (err) => {
          if (err) return reject(err);
          return resolve({
            run(...params) {
              return new Promise((resolveRun, rejectRun) => {
                stmt.run(params, function stmtRun(runErr) {
                  if (runErr) return rejectRun(runErr);
                  return resolveRun({ lastID: this.lastID, changes: this.changes });
                });
              });
            },
            finalize() {
              return new Promise((resolveFin, rejectFin) => {
                stmt.finalize((finErr) => (finErr ? rejectFin(finErr) : resolveFin()));
              });
            }
          });
        });
      });
    }
  };
}

function wrapPostgresDb(pool) {
  const db = {
    meta: { driver: 'postgres' },
    async exec(sql) {
      const statements = splitSqlStatements(String(sql || ''));
      for (const statement of statements) {
        await pool.query(statement);
      }
    },
    async get(sql, params = []) {
      const result = await pool.query(convertPlaceholders(String(sql || '').trim()), params);
      return result.rows[0];
    },
    async all(sql, params = []) {
      const result = await pool.query(convertPlaceholders(String(sql || '').trim()), params);
      return result.rows;
    },
    async run(sql, params = []) {
      const query = convertPlaceholders(String(sql || '').trim().replace(/;+\s*$/, ''));
      const isInsert = /^INSERT\s+/i.test(query);
      const hasReturning = /\sRETURNING\s+/i.test(query);

      if (isInsert && !hasReturning) {
        try {
          const result = await pool.query(`${query} RETURNING id`, params);
          return { lastID: result.rows[0]?.id ?? null, changes: result.rowCount || 0 };
        } catch (err) {
          const missingIdColumn = err && (err.code === '42703' || /column\s+"id"\s+does not exist/i.test(String(err.message)));
          if (!missingIdColumn) throw err;
        }
      }

      const result = await pool.query(query, params);
      return { lastID: isInsert ? (result.rows[0]?.id ?? null) : null, changes: result.rowCount || 0 };
    },
    async prepare(sql) {
      return {
        run(...params) {
          return db.run(sql, params);
        },
        async finalize() {
          return undefined;
        }
      };
    }
  };

  return db;
}

async function openPostgresDb() {
  const pool = getPostgresPool();
  const db = wrapPostgresDb(pool);
  await db.get('SELECT 1 AS ok');
  return db;
}

async function initDb(options = {}) {
  const { skipSeed = false } = options;
  const client = resolveDbClient();
  const db = client === 'postgres' ? await openPostgresDb() : await openDb();
  await db.exec(getSchemaSql(client));

  await migrateLegacySchema(db);
  if (!skipSeed) {
    await seedData(db);
  }
  return db;
}

async function getTableColumns(db, tableName) {
  if (!isValidIdentifier(tableName)) return [];

  if (db.meta?.driver === 'postgres') {
    const rows = await db.all(
      `SELECT column_name AS name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ?
       ORDER BY ordinal_position`,
      [tableName]
    );
    return rows.map((r) => r.name);
  }

  const rows = await db.all(`PRAGMA table_info(${tableName})`);
  return rows.map((r) => r.name);
}

async function hasTable(db, tableName) {
  if (!isValidIdentifier(tableName)) return false;

  if (db.meta?.driver === 'postgres') {
    const row = await db.get(
      `SELECT table_name AS name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ?`,
      [tableName]
    );
    return !!row;
  }

  const row = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`, [tableName]);
  return !!row;
}

async function ensureColumn(db, tableName, columnName, columnSql) {
  if (!isValidIdentifier(tableName) || !isValidIdentifier(columnName)) return;
  const columns = await getTableColumns(db, tableName);
  if (!columns.includes(columnName)) {
    await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSql}`);
  }
}

async function migrateLegacySchema(db) {
  const timestampType = db.meta?.driver === 'postgres' ? 'TIMESTAMPTZ' : 'TEXT';
  const autoPk = db.meta?.driver === 'postgres' ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';

  // users table migration from previous versions
  await ensureColumn(db, 'users', 'role', `TEXT DEFAULT 'student'`);
  await ensureColumn(db, 'users', 'is_banned', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'users', 'points', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'users', 'total_tests', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'users', 'correct_answers', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'users', 'total_questions', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'users', 'streak_days', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'users', 'last_test_date', 'TEXT');
  await ensureColumn(db, 'users', 'last_login_at', timestampType);
  await ensureColumn(db, 'users', 'created_at', timestampType);
  await ensureColumn(db, 'users', 'updated_at', timestampType);

  await db.run(`UPDATE users SET role = 'student' WHERE role IS NULL OR TRIM(role) = ''`);
  await db.run(`UPDATE users SET is_banned = COALESCE(is_banned, 0)`);
  await db.run(`UPDATE users SET points = COALESCE(points, 0)`);
  await db.run(`UPDATE users SET total_tests = COALESCE(total_tests, 0)`);
  await db.run(`UPDATE users SET correct_answers = COALESCE(correct_answers, 0)`);
  await db.run(`UPDATE users SET total_questions = COALESCE(total_questions, 0)`);
  await db.run(`UPDATE users SET streak_days = COALESCE(streak_days, 0)`);
  await db.run(`UPDATE users SET created_at = COALESCE(created_at, registration_date, CURRENT_TIMESTAMP)`);
  await db.run(`UPDATE users SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)`);

  await ensureColumn(db, 'users', 'provider', `TEXT DEFAULT 'local'`);
  await ensureColumn(db, 'users', 'google_sub', 'TEXT');
  await ensureColumn(db, 'users', 'email_verified', 'INTEGER DEFAULT 0');
  await db.run(`UPDATE users SET provider = COALESCE(provider, 'local')`);
  await db.run(`UPDATE users SET email_verified = COALESCE(email_verified, 0)`);
  await ensureColumn(db, 'ai_prompt_logs', 'model_name', 'TEXT');

  if (!(await hasTable(db, 'oauth_states'))) {
    await db.exec(`
      CREATE TABLE oauth_states (
        state TEXT PRIMARY KEY,
        purpose TEXT NOT NULL,
        redirect_path TEXT,
        created_at ${timestampType} DEFAULT CURRENT_TIMESTAMP,
        expires_at ${timestampType} NOT NULL
      );
    `);
  }

  await db.run(`DELETE FROM oauth_states WHERE expires_at <= ?`, [nowIso()]);

  if (!(await hasTable(db, 'chat_groups'))) {
    await db.exec(`
      CREATE TABLE chat_groups (
        id ${autoPk},
        name TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        created_at ${timestampType} DEFAULT CURRENT_TIMESTAMP,
        updated_at ${timestampType} DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(id)
      );
    `);
  }

  if (!(await hasTable(db, 'chat_group_members'))) {
    await db.exec(`
      CREATE TABLE chat_group_members (
        group_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','member')),
        joined_at ${timestampType} DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(group_id, user_id),
        FOREIGN KEY(group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  }

  if (!(await hasTable(db, 'chat_messages'))) {
    await db.exec(`
      CREATE TABLE chat_messages (
        id ${autoPk},
        group_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        message_text TEXT,
        message_type TEXT NOT NULL DEFAULT 'text' CHECK(message_type IN ('text','voice')),
        voice_blob_base64 TEXT,
        voice_mime_type TEXT,
        voice_duration_sec REAL,
        created_at ${timestampType} DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  }

  if (!(await hasTable(db, 'analytics_events'))) {
    await db.exec(`
      CREATE TABLE analytics_events (
        id ${autoPk},
        user_id INTEGER,
        visitor_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        event_name TEXT NOT NULL,
        path TEXT NOT NULL,
        page_title TEXT,
        referrer TEXT,
        source TEXT,
        medium TEXT,
        campaign TEXT,
        term TEXT,
        content TEXT,
        device_type TEXT,
        browser TEXT,
        os TEXT,
        meta_json TEXT,
        created_at ${timestampType} DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
  }

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
      ON analytics_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name
      ON analytics_events(event_name);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_path
      ON analytics_events(path);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_id
      ON analytics_events(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id
      ON analytics_events(session_id);
  `);

  // books table migration from old schema (link -> file_url)
  await ensureColumn(db, 'books', 'file_url', 'TEXT');
  await ensureColumn(db, 'books', 'cover_url', 'TEXT');
  await ensureColumn(db, 'books', 'featured', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'books', 'status', `TEXT DEFAULT 'published'`);
  await ensureColumn(db, 'books', 'created_at', timestampType);
  await ensureColumn(db, 'books', 'updated_at', timestampType);

  const bookCols = await getTableColumns(db, 'books');
  if (bookCols.includes('link')) {
    await db.run(`UPDATE books SET file_url = COALESCE(file_url, link)`);
  }
  if (bookCols.includes('file_url') && bookCols.includes('link')) {
    await db.run(`UPDATE books SET link = COALESCE(link, file_url, '')`);
  }
  await db.run(`UPDATE books SET status = COALESCE(status, 'published')`);
  await db.run(`UPDATE books SET featured = COALESCE(featured, 0)`);
  await db.run(
    `UPDATE books
     SET downloads = CASE
       WHEN CAST(downloads AS TEXT) LIKE '%.%k' THEN CAST(REPLACE(REPLACE(LOWER(CAST(downloads AS TEXT)), 'k', '00'), '.', '') AS INTEGER)
       WHEN CAST(downloads AS TEXT) LIKE '%k' THEN CAST(REPLACE(LOWER(CAST(downloads AS TEXT)), 'k', '000') AS INTEGER)
       ELSE COALESCE(CAST(downloads AS INTEGER), 0)
     END`
  );
  await db.run(`UPDATE books SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)`);
  await db.run(`UPDATE books SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)`);
}

async function seedData(db) {
  const now = nowIso();

  if (db.meta?.driver === 'postgres') {
    await db.run(
      `INSERT INTO ai_settings (id, rate_limit_per_minute, safe_mode_enabled, updated_at)
       VALUES (1, 30, 1, ?)
       ON CONFLICT (id) DO NOTHING`,
      [now]
    );

    await db.run(
      `INSERT INTO site_settings (id, site_name, maintenance_mode, allow_registration, updated_at)
       VALUES (1, 'Lawinate.uz', 0, 1, ?)
       ON CONFLICT (id) DO NOTHING`,
      [now]
    );
  } else {
    await db.run(
      `INSERT OR IGNORE INTO ai_settings (id, rate_limit_per_minute, safe_mode_enabled, updated_at)
       VALUES (1, 30, 1, ?)` ,
      [now]
    );

    await db.run(
      `INSERT OR IGNORE INTO site_settings (id, site_name, maintenance_mode, allow_registration, updated_at)
       VALUES (1, 'Lawinate.uz', 0, 1, ?)` ,
      [now]
    );
  }

  let admin = await db.get('SELECT id FROM users WHERE email = ?', [ADMIN_SEED_EMAIL]);
  if (!admin) {
    const hash = await bcrypt.hash(ADMIN_SEED_PASSWORD, 12);
    const created = await db.run(
      `INSERT INTO users (full_name, email, password_hash, role, university, city, registration_date, created_at, updated_at)
       VALUES (?, ?, ?, 'admin', ?, ?, ?, ?, ?)` ,
      ['Lawinate Super Admin', ADMIN_SEED_EMAIL, hash, 'Law Academy', 'Tashkent', now, now, now]
    );
    admin = { id: created.lastID };
  }

  const moderatorEmail = MODERATOR_SEED_EMAIL;
  const mod = await db.get('SELECT id FROM users WHERE email = ?', [moderatorEmail]);
  if (!mod) {
    const hash = await bcrypt.hash(MODERATOR_SEED_PASSWORD, 10);
    await db.run(
      `INSERT INTO users (full_name, email, password_hash, role, university, city, registration_date, created_at, updated_at)
       VALUES (?, ?, ?, 'moderator', ?, ?, ?, ?, ?)` ,
      ['Platform Moderator', moderatorEmail, hash, 'TDTU', 'Samarqand', now, now, now]
    );
  }

  const students = await db.get(`SELECT COUNT(*) as count FROM users WHERE role='student'`);
  if ((students.count || 0) === 0) {
    const hash = await bcrypt.hash(STUDENT_SEED_PASSWORD, 10);
    const seedUsers = [
      ['Ali Valiyev', 'ali@lawinate.uz', 'TDYU', 'Tashkent', 540],
      ['Malika Jurayeva', 'malika@lawinate.uz', 'JIDU', 'Bukhara', 620],
      ['Sardor Karimov', 'sardor@lawinate.uz', 'NamDU', 'Namangan', 410],
      ['Nilufar Rustamova', 'nilufar@lawinate.uz', 'SamDU', 'Samarqand', 770]
    ];
    const stmt = await db.prepare(
      `INSERT INTO users (full_name, email, password_hash, role, university, city, points, registration_date, created_at, updated_at)
       VALUES (?, ?, ?, 'student', ?, ?, ?, ?, ?, ?)`
    );
    for (const item of seedUsers) {
      await stmt.run(item[0], item[1], hash, item[2], item[3], item[4], now, now, now);
    }
    await stmt.finalize();
  }

  const testsCount = await db.get('SELECT COUNT(*) as count FROM tests');
  if ((testsCount.count || 0) === 0) {
    const tests = [
      ['Konstitutsiya asoslari', 'konstitutsiya', 'medium', 'published'],
      ['Jinoyat huquqi start', 'jinoyat', 'easy', 'published'],
      ['Fuqarolik huquqi', 'fuqarolik', 'medium', 'published'],
      ['DTM sinov', 'dtm', 'hard', 'published'],
      ['Mehnat huquqi', 'mehnat', 'medium', 'draft']
    ];
    const stmt = await db.prepare(
      `INSERT INTO tests (title, category, difficulty, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const item of tests) {
      await stmt.run(item[0], item[1], item[2], item[3], admin.id, now, now);
    }
    await stmt.finalize();
  }

  const questionsCount = await db.get('SELECT COUNT(*) as count FROM questions');
  if ((questionsCount.count || 0) === 0) {
    const tests = await db.all('SELECT id, category, status FROM tests');
    const tmpl = {
      konstitutsiya: [
        ['Konstitutsiya qachon qabul qilingan?', '8-dekabr 1992', '1-sentabr 1991', '31-avgust 1991', '30-aprel 2023', 'A'],
        ['Davlat hokimiyati manbai kim?', 'Prezident', 'Xalq', 'Sud', 'Vazirlar', 'B']
      ],
      jinoyat: [
        ['Jinoiy javobgarlik umumiy yoshi?', '13', '14', '16', '18', 'C'],
        ['Retsidiv nima?', 'Birinchi jinoyat', 'Takroriy jinoyat', 'Avf', 'Jarima', 'B']
      ],
      fuqarolik: [
        ['Huquq layoqati qachondan?', '18 yoshdan', 'Tugilgandan', 'Nikohdan', '16 yoshdan', 'B'],
        ['Mulk huquqi elementlari?', '2 ta', '3 ta', '4 ta', '1 ta', 'B']
      ],
      dtm: [
        ['Inson huquqlari deklaratsiyasi qachon?', '1945', '1948', '1950', '1960', 'B'],
        ['Bayroq qachon qabul qilingan?', '1991-11-18', '1992-12-08', '1991-08-31', '1992-07-02', 'A']
      ],
      mehnat: [
        ['Haftalik ish vaqti?', '36', '40', '42', '48', 'B'],
        ['Sinov muddati odatda?', '1 oy', '3 oy', '6 oy', '12 oy', 'B']
      ]
    };

    const stmt = await db.prepare(
      `INSERT INTO questions (test_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const test of tests) {
      const list = tmpl[test.category] || [];
      for (const q of list) {
        await stmt.run(test.id, q[0], q[1], q[2], q[3], q[4], q[5], 'Demo explanation', test.status === 'published' ? 'published' : 'draft', now, now);
      }
    }
    await stmt.finalize();
  }

  const booksCount = await db.get('SELECT COUNT(*) as count FROM books');
  if ((booksCount.count || 0) === 0) {
    const bookCols = await getTableColumns(db, 'books');
    const books = [
      ['Jinoyat huquqi (2020)', 'Darslik', 'jinoyat', 'https://www.dropbox.com/scl/fi/8dcgtq1p3pj85cf00c6g6/_-_-_-_-_-_2020-2.pdf?rlkey=to4pm5fhbtud4ui5rwku3tj66&st=prnxd8q8&raw=1', 2400, 0],
      ['Fuqarolik huquqi', "O'quv qo'llanma", 'fuqarolik', 'https://www.dropbox.com/scl/fi/qrqs8nyraef1b9ejlkpec/Fuqarolik-huquqi.pdf?rlkey=e2pp3mg3claj730dkh3hwzf68&st=dfutd2t9&raw=1', 1800, 1],
      ["O'zbekiston Konstitutsiyasi", 'Yangi tahrir', 'kodeks', 'https://www.dropbox.com/scl/fi/z6uga8ex71x83t1n9h5mk/constitution_oz.pdf?rlkey=3aknav73hv3p5erv6fgdu7fal&st=ajhen0w6&raw=1', 5200, 0],
      ["Ma'muriy huquq", "G'oziyev A. (2023)", 'mamuriy', 'https://www.dropbox.com/scl/fi/kwapcv04pmj76y9xxqee4/Goziyev_A._Ma-muriy_huquqi_2023-1.pdf?rlkey=59t2dwoggwpdghtmvakfc7kk9&st=rgp4lzb6&raw=1', 1500, 0],
      ['Davlat tilida ish yuritish', "Amaliy qo'llanma", 'hujjat', 'https://www.dropbox.com/scl/fi/t8xl79cn6jep0guhvm1a2/Kitoblaro_bot-DAVLAT-TILIDA-ISH-YURITISH.PDF.pdf?rlkey=bqi4pic52qgiezzb33j31rm1i&st=owhkow10&raw=1', 3100, 0]
    ];
    const stmt = await db.prepare(
      bookCols.includes('link')
        ? `INSERT INTO books (title, author, category, link, file_url, cover_url, downloads, featured, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`
        : `INSERT INTO books (title, author, category, file_url, cover_url, downloads, featured, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`
    );
    for (const b of books) {
      if (bookCols.includes('link')) {
        await stmt.run(b[0], b[1], b[2], b[3], b[3], '', b[4], b[5], now, now);
      } else {
        await stmt.run(b[0], b[1], b[2], b[3], '', b[4], b[5], now, now);
      }
    }
    await stmt.finalize();
  }

  const postsCount = await db.get('SELECT COUNT(*) as count FROM community_posts');
  if ((postsCount.count || 0) === 0) {
    const users = await db.all(`SELECT id FROM users WHERE role='student' LIMIT 3`);
    for (let i = 0; i < users.length; i += 1) {
      const post = await db.run(
        `INSERT INTO community_posts (user_id, title, content, status, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?)` ,
        [users[i].id, `Demo post ${i + 1}`, 'Bu demo community posti.', now, now]
      );
      await db.run(
        `INSERT INTO community_comments (post_id, user_id, content, status, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?)` ,
        [post.lastID, users[0].id, 'Demo comment', now, now]
      );
    }
  }

  const faqCount = await db.get('SELECT COUNT(*) as count FROM faq_templates');
  if ((faqCount.count || 0) === 0) {
    await db.run(
      `INSERT INTO faq_templates (title, question_template, answer_template, is_active, updated_at)
       VALUES ('AI limit', 'AI nega cheklangan?', 'Spam oldini olish uchun limit bor.', 1, ?)` ,
      [now]
    );
  }

  const resultsCount = await db.get('SELECT COUNT(*) as count FROM results');
  if ((resultsCount.count || 0) === 0) {
    const users = await db.all(`SELECT id FROM users WHERE role='student' LIMIT 4`);
    const tests = await db.all(`SELECT id, category FROM tests WHERE status='published'`);

    for (const user of users) {
      let points = 0;
      let totalTests = 0;
      let correctAnswers = 0;
      let totalQuestions = 0;

      for (let i = 0; i < tests.length; i += 1) {
        const total = 2;
        const correct = clampNumber(((user.id + i) % 2) + 1, 1, 2, 1);
        const score = Math.round((correct / total) * 100);
        const earned = correct * 20;

        await db.run(
          `INSERT INTO results (user_id, test_id, category, correct_count, total_questions, score, points_earned, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
          [user.id, tests[i].id, tests[i].category, correct, total, score, earned, now]
        );

        points += earned;
        totalTests += 1;
        correctAnswers += correct;
        totalQuestions += total;
      }

      await db.run(
        `UPDATE users
         SET points=?, total_tests=?, correct_answers=?, total_questions=?, streak_days=1, last_test_date=?, updated_at=?
         WHERE id=?` ,
        [points, totalTests, correctAnswers, totalQuestions, getTodayDate(), now, user.id]
      );
    }
  }

  const activity = await db.get('SELECT COUNT(*) as count FROM admin_activity_logs');
  if ((activity.count || 0) === 0) {
    await db.run(
      `INSERT INTO admin_activity_logs (admin_id, action, entity_type, meta_json, created_at)
       VALUES (?, 'seed:init', 'system', '{"ok":true}', ?)` ,
      [admin.id, now]
    );
  }

  const groupCount = await db.get('SELECT COUNT(*) as count FROM chat_groups');
  if ((groupCount.count || 0) === 0) {
    const createdGroup = await db.run(
      `INSERT INTO chat_groups (name, created_by, created_at, updated_at)
       VALUES ('Global Legal Chat', ?, ?, ?)` ,
      [admin.id, now, now]
    );

    await db.run(
      `INSERT INTO chat_group_members (group_id, user_id, role, joined_at)
       VALUES (?, ?, 'owner', ?)` ,
      [createdGroup.lastID, admin.id, now]
    );
  }
}

async function logAdminAction(db, adminId, action, entityType, entityId = null, meta = {}) {
  if (!adminId) return;
  await db.run(
    `INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, meta_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)` ,
    [adminId, action, entityType, entityId, JSON.stringify(meta || {}), nowIso()]
  );
}

module.exports = {
  DB_FILE,
  ADMIN_SEED_EMAIL,
  initDb,
  logAdminAction
};
