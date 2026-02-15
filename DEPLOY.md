# Deploy Guide

## 1. Install dependencies

```bash
npm install
npm --prefix fullstack_app/client install
npm --prefix fullstack_app/server install
```

## 2. Configure environment variables

Create local env files from examples:

```bash
copy fullstack_app\\server\\.env.example fullstack_app\\server\\.env
copy fullstack_app\\client\\.env.example fullstack_app\\client\\.env
```

Set real values before production:

- `JWT_SECRET` (required in production)
- `OPENROUTER_API_KEY` (required only if AI endpoint is used)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (required only if Google login is used)
- `APP_BASE_URL` and/or `CLIENT_URL`
- `CORS_ORIGIN` (comma-separated allowed origins)
- `SQLITE_DB_FILE` (recommended in production, e.g. `/var/data/database.db` on Render with persistent disk)
- `DATABASE_URL` (optional: PostgreSQL health check only)

## 3. Build frontend

```bash
npm run client:build
```

## 4. Run backend

```bash
npm --prefix fullstack_app/server start
```

## 5. Health check

`GET /api/health` should return status `ok`.

## Render Backend Deploy

Use one of these methods.

### Method 1: Blueprint (recommended)

1. Push code to GitHub.
2. In Render dashboard, click `New +` -> `Blueprint`.
3. Select this repo.
4. Render reads `render.yaml` from repo root and creates `lawinate-backend`.
5. In Render service `Environment`, set secret values for vars with `sync: false`.

### Method 2: Manual service

Set these values in Render when creating Web Service:

- `Root Directory`: `fullstack_app/server`
- `Build Command`: `npm install`
- `Start Command`: `npm start`
- `Health Check Path`: `/api/health`

Required env vars for startup:

- `NODE_ENV=production`
- `JWT_SECRET`
- `APP_BASE_URL` or `CLIENT_URL`
- `CORS_ORIGIN` (for Netlify origin, can be comma-separated)

Recommended production values:

- `APP_BASE_URL=https://lawinate.uz`
- `CLIENT_URL=https://lawinate.uz`
- `CORS_ORIGIN=https://lawinate.uz,https://www.lawinate.uz,https://lawinate.netlify.app`
- `SQLITE_DB_FILE=/var/data/database.db` (if you attach Render disk)
- `GOOGLE_REDIRECT_URI=https://lawinate-sc7t.onrender.com/api/auth/google/callback`
- `DATABASE_URL=postgresql://...` (optional)

## Netlify Frontend Deploy

- `netlify.toml` includes `/api/*` proxy to `https://lawinate-sc7t.onrender.com`.
- If your Render URL is different, update that redirect target.
- Optional alternative: set Netlify env variable `REACT_APP_API_URL=https://lawinate-sc7t.onrender.com`.

## Notes

- `.env` files, build artifacts, and `database.db` are git-ignored.
- Seed admin credentials are controlled via env variables (`ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`).
- Current app auth/content data is stored in SQLite. Without persistent disk, data resets after restart/redeploy.
