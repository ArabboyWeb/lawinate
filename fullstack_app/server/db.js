const { Pool } = require('pg');

let pool = null;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getDatabaseUrl() {
  const rawUrl = String(process.env.DATABASE_URL || '').trim();
  if (!rawUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const parsed = new URL(rawUrl);

  // node-postgres does not use these libpq params.
  parsed.searchParams.delete('channel_binding');
  parsed.searchParams.delete('sslmode');

  return parsed.toString();
}

function getPool() {
  if (pool) return pool;

  pool = new Pool({
    connectionString: getDatabaseUrl(),
    ssl: {
      rejectUnauthorized: false
    },
    max: parsePositiveInt(process.env.PG_POOL_MAX, 10),
    idleTimeoutMillis: parsePositiveInt(process.env.PG_IDLE_TIMEOUT_MS, 30000),
    connectionTimeoutMillis: parsePositiveInt(process.env.PG_CONNECTION_TIMEOUT_MS, 10000)
  });

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error', err);
  });

  return pool;
}

function query(text, params = []) {
  return getPool().query(text, params);
}

async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = {
  getPool,
  query,
  closePool
};
