# Setup

## Local development

No accounts needed. Without `DATABASE_URL` and `SUPABASE_*`, the API uses an embedded Postgres (PGlite) and keeps images on disk under `DATA_DIR` (default `../equallyshare-private-data`, outside the Vite root).

```text
npm install
npm test
npm run dev        # UI on http://localhost:3000, API on PORT (default 3001) behind Vite's /api proxy
```

Without `VITE_SUPABASE_*` the share page polls every 2 seconds instead of using Realtime. `npm run dev` reads an optional `.env` (copy `.env.example`).

## Supabase (free plan)

1. Create a free project at supabase.com.
2. **Storage → New bucket:** name `share-originals`, keep it **private** (Public bucket off).
3. **Connect → Transaction pooler** (port 6543): copy the connection string with your database password. This is `DATABASE_URL`.
4. **Project Settings → API keys:** copy the project URL (`SUPABASE_URL`, also `VITE_SUPABASE_URL`), the **anon/publishable** key (`VITE_SUPABASE_ANON_KEY`, public, used by browsers to listen for Realtime signals) and the **service_role** secret key (`SUPABASE_SERVICE_ROLE_KEY`, server-only).
   **Realtime → Settings:** keep public channels allowed (do not enable "private channels only"); the broadcast carries only `{ revision, status }`.
5. Create the tables (row level security is enabled on all of them):

   ```text
   DATABASE_URL="postgresql://..." npm run db:migrate
   ```

Free projects pause after 7 days without activity. Before a demo, open the dashboard and restore the project if it is paused.

## Vercel (Hobby, free)

1. Import the GitHub repo as a Vercel project. `vercel.json` sets the build (`vite build` → `dist/client`) and routes `/api/*` to `api/index.ts`.
2. **Settings → Environment Variables** (Production):
   - `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (read at build time; redeploy after changing them)
   - `CRON_SECRET`: any long random string. Vercel Cron calls `/api/cron/cleanup` daily at 03:00 UTC with it, deleting ended/expired shares, their images and expired sessions.
   - `PUBLIC_ORIGIN` = the deployment origin, e.g. `https://<project>.vercel.app` (no trailing slash). Share URLs and QR codes use it, and requests from other origins are rejected.
3. Deploy, then check `https://<project>.vercel.app/api/health` returns `{"status":"ok"}`.

Never commit real keys; `.env` files are git-ignored and `.env.example` holds names only.

## Limits

- Uploads: 4 MiB (Vercel rejects request bodies above 4.5 MB).
- Recipients: 64 per share (`MAX_RECIPIENTS`).
- Shares expire 24 hours after creation.
