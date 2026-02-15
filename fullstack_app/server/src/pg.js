const { Pool } = require('pg');

let pool = null;

function getDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL || '';
  if (!rawUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const parsed = new URL(rawUrl);

  // node-postgres does not use libpq channel_binding parameter.
  if (parsed.searchParams.has('channel_binding')) {
    parsed.searchParams.delete('channel_binding');
  }
  if (parsed.searchParams.has('sslmode')) {
    parsed.searchParams.delete('sslmode');
  }

  return parsed.toString();
}

function getPostgresPool() {
  if (pool) return pool;

  pool = new Pool({
    connectionString: getDatabaseUrl(),
    ssl: {
      rejectUnauthorized: false
    }
  });

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error', err);
  });

  return pool;
}

async function checkPostgresConnection() {
  const startedAt = Date.now();
  const client = await getPostgresPool().connect();
  try {
    await client.query('SELECT 1 AS ok');
    return {
      ok: true,
      latency_ms: Date.now() - startedAt
    };
  } finally {
    client.release();
  }
}

module.exports = {
  getPostgresPool,
  checkPostgresConnection
};
