const { getPool } = require('../db');

function getPostgresPool() {
  return getPool();
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
