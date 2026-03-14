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
- `DATABASE_URL` (required for Neon/PostgreSQL production)
- `DB_CLIENT=postgres`

Production safety rule:

- use external PostgreSQL/Neon via `DATABASE_URL`
- backend redeploy is safe only when app data lives in PostgreSQL/Neon
- app runtime is PostgreSQL-only now; local SQLite fallback is disabled

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
- `DATABASE_URL`
- `JWT_SECRET`
- `APP_BASE_URL` or `CLIENT_URL`
- `CORS_ORIGIN` (frontend originlari, comma-separated)

Recommended production values:

- `APP_BASE_URL=https://lawinate.uz`
- `CLIENT_URL=https://lawinate.uz`
- `CORS_ORIGIN=https://lawinate.uz,https://www.lawinate.uz,https://your-project.vercel.app`
- `DATABASE_URL=postgresql://...` (Neon)
- `DB_CLIENT=postgres`
- `GOOGLE_REDIRECT_URI=https://lawinate-sc7t.onrender.com/api/auth/google/callback`

Important:

- frontend redeploy on Vercel does not delete PostgreSQL data
- backend redeploy on Render also does not delete PostgreSQL data
- this app now refuses to start if `DATABASE_URL` is missing or `DB_CLIENT` is not `postgres`

## Vercel Frontend Deploy

Use Vercel for the frontend and keep the backend on Render.

1. Push this repo to GitHub.
2. In Vercel, click `Add New` -> `Project` and import the repo.
3. In `Root Directory`, select `fullstack_app/client`.
4. Leave the Framework Preset on `Create React App` (or let Vercel auto-detect it).
5. Deploy. No frontend env vars are required if you want same-origin `/api` proxying.

Production notes:

- [fullstack_app/client/vercel.json](/c:/Users/user/Desktop/fullstack_app/fullstack_app/client/vercel.json) proxies `/api/*` to `https://lawinate-sc7t.onrender.com/api/*`.
- If your Render backend URL changes, update that destination in [fullstack_app/client/vercel.json](/c:/Users/user/Desktop/fullstack_app/fullstack_app/client/vercel.json).
- Preferred: leave `REACT_APP_API_URL` unset in production so the frontend uses the same-origin `/api` proxy.
- Optional alternative: set Vercel env variable `REACT_APP_API_URL=https://lawinate-sc7t.onrender.com` only if direct cross-origin requests are required and CORS is configured correctly.
- Add your Vercel domain to backend `CORS_ORIGIN` on Render, for example `https://your-project.vercel.app`.

## Notes

- `.env` files, build artifacts, and `database.db` are git-ignored.
- Seed admin credentials are controlled via env variables (`ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`).
- App data is stored in PostgreSQL when `DATABASE_URL` is set (recommended for production).
