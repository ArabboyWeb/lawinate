require('dotenv').config({ quiet: true });

const DEFAULT_PORT = process.env.PORT || 3001;
const targetUrl = process.env.DB_TEST_URL || `http://localhost:${DEFAULT_PORT}/api/db-test`;

async function main() {
  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  const rawBody = await response.text();
  let payload = null;

  try {
    payload = JSON.parse(rawBody);
  } catch (_err) {
    payload = { raw: rawBody };
  }

  if (response.ok && payload?.status === 'connected' && payload?.db_time) {
    console.log(JSON.stringify(payload, null, 2));
    process.exit(0);
  }

  console.error(JSON.stringify({
    status: 'failed',
    url: targetUrl,
    http_status: response.status,
    response: payload
  }, null, 2));
  process.exit(1);
}

main().catch((err) => {
  console.error(JSON.stringify({
    status: 'failed',
    url: targetUrl,
    error: err?.message || String(err)
  }, null, 2));
  process.exit(1);
});
