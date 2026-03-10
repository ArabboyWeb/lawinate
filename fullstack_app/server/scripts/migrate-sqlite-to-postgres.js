require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

process.env.DB_CLIENT = 'postgres';

const { initDb } = require('../src/db');
const { getPostgresPool } = require('../src/pg');

const TABLE_IMPORT_ORDER = [
  'users',
  'tests',
  'questions',
  'results',
  'books',
  'community_posts',
  'community_comments',
  'community_reports',
  'user_warnings',
  'ai_prompt_logs',
  'ai_settings',
  'faq_templates',
  'site_settings',
  'admin_activity_logs',
  'password_resets',
  'oauth_states',
  'chat_groups',
  'chat_group_members',
  'chat_messages',
  'blog_posts'
];

function quoteIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function isValidIdentifier(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(value || ''));
}

function openSqliteDatabase(filename) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filename, (err) => {
      if (err) return reject(err);
      return resolve(db);
    });
  });
}

function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      return resolve(rows);
    });
  });
}

function closeSqlite(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

function orderTables(tables) {
  const rank = TABLE_IMPORT_ORDER.reduce((acc, table, idx) => {
    acc[table] = idx;
    return acc;
  }, {});

  return [...tables].sort((a, b) => {
    const ra = rank[a] ?? Number.MAX_SAFE_INTEGER;
    const rb = rank[b] ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}

async function getPostgresColumns(pool, tableName) {
  const rows = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );
  return rows.rows.map((row) => row.column_name);
}

async function resetSequence(pool, tableName) {
  const sequenceRow = await pool.query(`SELECT pg_get_serial_sequence($1, 'id') AS seq`, [tableName]);
  const sequenceName = sequenceRow.rows[0]?.seq;
  if (!sequenceName) return;

  await pool.query(
    `SELECT setval($1, COALESCE((SELECT MAX(id) FROM ${quoteIdentifier(tableName)}), 1), true)`,
    [sequenceName]
  );
}

async function importTable({ sqliteDb, pgPool, tableName }) {
  if (!isValidIdentifier(tableName)) return { inserted: 0, skipped: true };

  const sqliteColumnsRows = await sqliteAll(sqliteDb, `PRAGMA table_info(${tableName})`);
  const sqliteColumns = sqliteColumnsRows.map((row) => row.name);
  if (sqliteColumns.length === 0) return { inserted: 0, skipped: true };

  const pgColumns = await getPostgresColumns(pgPool, tableName);
  if (pgColumns.length === 0) return { inserted: 0, skipped: true };

  const insertColumns = sqliteColumns.filter((col) => pgColumns.includes(col));
  if (insertColumns.length === 0) return { inserted: 0, skipped: true };

  const rows = await sqliteAll(sqliteDb, `SELECT * FROM ${quoteIdentifier(tableName)}`);
  if (rows.length === 0) return { inserted: 0, skipped: false };

  const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(', ');
  const columnList = insertColumns.map((col) => quoteIdentifier(col)).join(', ');
  const insertSql = `INSERT INTO ${quoteIdentifier(tableName)} (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

  let inserted = 0;
  for (const row of rows) {
    const values = insertColumns.map((col) => row[col]);
    const result = await pgPool.query(insertSql, values);
    inserted += result.rowCount || 0;
  }

  if (insertColumns.includes('id')) {
    await resetSequence(pgPool, tableName);
  }

  return { inserted, skipped: false };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for PostgreSQL migration');
  }

  const sqliteFile = process.env.SQLITE_SOURCE_FILE
    ? path.resolve(process.env.SQLITE_SOURCE_FILE)
    : process.env.SQLITE_DB_FILE
    ? path.resolve(process.env.SQLITE_DB_FILE)
    : path.join(__dirname, '..', 'database.db');

  if (!fs.existsSync(sqliteFile)) {
    throw new Error(`SQLite file not found: ${sqliteFile}`);
  }

  await initDb({ skipSeed: true });
  const pgPool = getPostgresPool();
  const sqliteDb = await openSqliteDatabase(sqliteFile);

  try {
    const tableRows = await sqliteAll(
      sqliteDb,
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    );

    const tableNames = orderTables(
      tableRows
        .map((row) => row.name)
        .filter((name) => isValidIdentifier(name))
    );

    for (const tableName of tableNames) {
      const result = await importTable({ sqliteDb, pgPool, tableName });
      const status = result.skipped ? 'skipped' : `${result.inserted} inserted`;
      console.log(`[migrate] ${tableName}: ${status}`);
    }
  } finally {
    await closeSqlite(sqliteDb);
    await pgPool.end();
  }
}

main()
  .then(() => {
    console.log('SQLite -> PostgreSQL migration completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('SQLite -> PostgreSQL migration failed', err);
    process.exit(1);
  });
