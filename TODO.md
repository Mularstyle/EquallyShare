# TODO

## Completed

- [x] Scaffold Node 22/TypeScript/Vite/Vitest project and grapheme-aware text partitioning.
- [x] Add SQLite persistence, anonymous HttpOnly session identity, text shares, QR/URL creation, idempotent joins, and HTTP validation.
- [x] Add deterministic image collage allocation, image validation/storage/rendering, and recipient-only image responses.

## In progress

- ไม่มีงานค้างจาก checkpoint นี้

## Handoff checkpoint

- [x] Commit and push the verified Task 1–3 foundation (`9e206c1` to `origin/master`).

## Next

- [ ] **User:** create a free Supabase project and a Vercel project; put `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `PUBLIC_ORIGIN` in Vercel env vars (never in the repo).
- [ ] Port persistence from `node:sqlite` to Supabase Postgres (schema migration, row-locked joins), images to a private Supabase Storage bucket, and the API to Vercel Functions; lower upload limit to 4 MiB. Keep the existing tests passing against the new backend.
- [ ] Replace the planned `ws` broadcast (Task 4) with Supabase Realtime Broadcast of `{ revision, status }` only; browsers refetch their snapshot.
- [ ] Add daily Vercel Cron cleanup of expired shares and their stored images.
- [ ] Add Creator-only End share: endpoint, `ended` status that rejects joins, realtime broadcast, and button in Creator UI.
- [ ] Add revision-safe WebSocket broadcasting, reconnect snapshots, heartbeat, and exact 24-hour expiration cleanup (Task 4).
- [ ] Build Creator/Recipient React UI, QR fallback state, Web Locks bootstrap, and responsive states.
- [ ] Add Playwright multi-browser/restart tests and bounded demo load test (64 recipients; #65 gets `429 RECIPIENT_LIMIT`).
- [ ] Add Vercel config (`vercel.json`), setup/demo documentation, and update Project.md with verified results (replaces Docker packaging).
- [ ] Verify public HTTPS/mobile QR flow on Vercel.
