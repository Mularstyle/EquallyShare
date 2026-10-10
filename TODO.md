# TODO

## Completed

- [x] Scaffold Node 22/TypeScript/Vite/Vitest project and grapheme-aware text partitioning.
- [x] Add SQLite persistence, anonymous HttpOnly session identity, text shares, QR/URL creation, idempotent joins, and HTTP validation.
- [x] Add deterministic image collage allocation, image validation/storage/rendering, and recipient-only image responses.

- [x] Port backend to Postgres (Supabase in prod, PGlite in tests/dev), private image storage (Supabase Storage / local disk), Vercel Function entry, 4 MiB uploads, RLS on all tables, realtime signal on join. 34 tests pass.

## In progress

- ไม่มีงานค้างจาก checkpoint นี้

## Handoff checkpoint

- [x] Commit and push the verified Task 1–3 foundation (`9e206c1` to `origin/master`).

## Next

- [ ] **User:** create a free Supabase project and a Vercel project; put `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `PUBLIC_ORIGIN` in Vercel env vars (never in the repo).
- [ ] Browser side of realtime (Task 4/5): subscribe to `share:<id>` with the Supabase anon key, refetch the snapshot on `share-changed`, ignore older revisions, refetch on reconnect. Server publish on join is done.
- [ ] Verify the `postgres` driver path against a real Supabase database (`npm run db:migrate`, then the API on Vercel); only PGlite is covered by tests.
- [ ] Add daily Vercel Cron cleanup of expired shares and their stored images.
- [ ] Add Creator-only End share: endpoint, `ended` status that rejects joins, realtime broadcast, and button in Creator UI.
- [ ] Add revision-safe WebSocket broadcasting, reconnect snapshots, heartbeat, and exact 24-hour expiration cleanup (Task 4).
- [ ] Build Creator/Recipient React UI, QR fallback state, Web Locks bootstrap, and responsive states.
- [ ] Add Playwright multi-browser/restart tests and bounded demo load test (64 recipients; #65 gets `429 RECIPIENT_LIMIT`).
- [ ] Add Vercel config (`vercel.json`), setup/demo documentation, and update Project.md with verified results (replaces Docker packaging).
- [ ] Verify public HTTPS/mobile QR flow on Vercel.
