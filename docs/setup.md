# Setup

## Local development

No accounts needed. Without `DATABASE_URL` and `SUPABASE_*`, the API uses an embedded Postgres (PGlite) and keeps images on disk under `DATA_DIR` (default `../equallyshare-private-data`, outside the Vite root).

```text
npm install
npm test
npm run dev        # Vite + API on PORT (default 3000)
```

`npm run dev` needs the React UI in `src/web/` (Task 5); until then only the API runs.

## Supabase (free plan)

1. Create a free project at supabase.com.
2. **Storage → New bucket:** name `share-originals`, keep it **private** (Public bucket off).
3. **Connect → Transaction pooler** (port 6543): copy the connection string with your database password. This is `DATABASE_URL`.
4. **Project Settings → API keys:** copy the project URL (`SUPABASE_URL`) and the **service_role** secret key (`SUPABASE_SERVICE_ROLE_KEY`). The service-role key is server-only. The anon/publishable key will be used by the browser for Realtime once the UI exists.
5. Create the tables (row level security is enabled on all of them):

   ```text
   DATABASE_URL="postgresql://..." npm run db:migrate
   ```

Free projects pause after 7 days without activity. Before a demo, open the dashboard and restore the project if it is paused.

## Vercel (Hobby, free)

1. Import the GitHub repo as a Vercel project. `vercel.json` sets the build (`vite build` → `dist/client`) and routes `/api/*` to `api/index.ts`.
2. **Settings → Environment Variables** (Production):
   - `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `PUBLIC_ORIGIN` = the deployment origin, e.g. `https://<project>.vercel.app` (no trailing slash). Share URLs and QR codes use it, and requests from other origins are rejected.
3. Deploy, then check `https://<project>.vercel.app/api/health` returns `{"status":"ok"}`.

Never commit real keys; `.env` files are git-ignored and `.env.example` holds names only.

## Limits

- Uploads: 4 MiB (Vercel rejects request bodies above 4.5 MB).
- Recipients: 64 per share (`MAX_RECIPIENTS`).
- Shares expire 24 hours after creation.
