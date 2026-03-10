require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const { getPool, closePool } = require('../db');

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

function parsePositiveInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeBookRow(row) {
  const title = String(row.title || '').trim();
  const author = String(row.author || '').trim();
  const category = String(row.category || '').trim();
  const fileUrl = String(row.file_url || '').trim();
  const coverUrl = String(row.cover_url || '').trim();
  const status = String(row.status || 'published').trim().toLowerCase();

  if (!title || !author || !category || !fileUrl) return null;
  if (status !== 'published') return null;
  if (/example\.com/i.test(fileUrl) || /example\.com/i.test(coverUrl)) return null;

  return {
    title,
    author,
    category,
    file_url: fileUrl,
    cover_url: coverUrl,
    downloads: parsePositiveInt(row.downloads, 0),
    featured: row.featured ? 1 : 0,
    status: 'published',
  };
}

async function restoreBooks({ sqliteDb, pgPool }) {
  const sqliteRows = await sqliteAll(
    sqliteDb,
    `SELECT title, author, category, file_url, cover_url, downloads, featured, status
     FROM books
     ORDER BY id ASC`
  );

  const summary = {
    scanned: sqliteRows.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
  };

  for (const sqliteRow of sqliteRows) {
    const book = normalizeBookRow(sqliteRow);
    if (!book) {
      summary.skipped += 1;
      continue;
    }

    const existing = await pgPool.query(
      `SELECT id, author, file_url, cover_url, downloads, featured, status
       FROM books
       WHERE LOWER(title) = LOWER($1) AND LOWER(category) = LOWER($2)
       ORDER BY id ASC
       LIMIT 1`,
      [book.title, book.category]
    );

    if (existing.rows[0]) {
      const row = existing.rows[0];
      const hasChanges =
        String(row.author || '') !== book.author
        || String(row.file_url || '') !== book.file_url
        || String(row.cover_url || '') !== book.cover_url
        || Number(row.featured || 0) !== book.featured
        || String(row.status || '') !== book.status
        || Number(row.downloads || 0) < book.downloads;

      if (!hasChanges) {
        summary.skipped += 1;
        continue;
      }

      await pgPool.query(
        `UPDATE books
         SET author = $1,
             file_url = $2,
             cover_url = $3,
             downloads = GREATEST(COALESCE(downloads, 0), $4),
             featured = $5,
             status = $6,
             updated_at = NOW()
         WHERE id = $7`,
        [
          book.author,
          book.file_url,
          book.cover_url,
          book.downloads,
          book.featured,
          book.status,
          row.id,
        ]
      );
      summary.updated += 1;
      continue;
    }

    await pgPool.query(
      `INSERT INTO books
       (title, author, category, file_url, cover_url, downloads, featured, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [
        book.title,
        book.author,
        book.category,
        book.file_url,
        book.cover_url,
        book.downloads,
        book.featured,
        book.status,
      ]
    );
    summary.inserted += 1;
  }

  return summary;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const sqliteFile = process.env.SQLITE_SOURCE_FILE
    ? path.resolve(process.env.SQLITE_SOURCE_FILE)
    : process.env.SQLITE_DB_FILE
    ? path.resolve(process.env.SQLITE_DB_FILE)
    : path.join(__dirname, '..', 'database.db');

  if (!fs.existsSync(sqliteFile)) {
    throw new Error(`SQLite file not found: ${sqliteFile}`);
  }

  const sqliteDb = await openSqliteDatabase(sqliteFile);
  const pgPool = getPool();

  try {
    const summary = await restoreBooks({ sqliteDb, pgPool });
    console.log(`[restore-books] sqlite: ${sqliteFile}`);
    console.log(`[restore-books] scanned=${summary.scanned} inserted=${summary.inserted} updated=${summary.updated} skipped=${summary.skipped}`);
  } finally {
    await closeSqlite(sqliteDb);
    await closePool();
  }
}

main()
  .then(() => {
    console.log('Book restore completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Book restore failed', err);
    process.exit(1);
  });
