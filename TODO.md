# TODO

## Completed

- [x] Scaffold Node 22/TypeScript/Vite/Vitest project and grapheme-aware text partitioning.
- [x] Add SQLite persistence, anonymous HttpOnly session identity, text shares, QR/URL creation, idempotent joins, and HTTP validation.
- [x] Add deterministic image collage allocation, image validation/storage/rendering, and recipient-only image responses.

- [x] Port backend to Postgres (Supabase in prod, PGlite in tests/dev), private image storage (Supabase Storage / local disk), Vercel Function entry, 4 MiB uploads, RLS on all tables, realtime signal on join. 34 tests pass.

- [x] End share (creator-only endpoint, `ended` status, realtime signal, UI button) and daily Vercel Cron cleanup of ended/expired shares, images and sessions.
- [x] Creator/Recipient React UI on the `frontend` branch's XP design: TEXT/IMAGE input, live portion view, URL + QR, End share, Web Locks session bootstrap, Supabase Realtime with polling fallback, loading/ended/expired/not-found/limit/offline states, phone layout. Verified by hand in a browser.

- [x] MP3 audio shares (time segments per recipient), including live database migration.

- [x] MP4 video shares (time segments by keyframe, direct upload to storage up to 50 MB), including live database migration.

## In progress

- ไม่มีงานค้างจาก checkpoint นี้

## Handoff checkpoint

- [x] Commit and push the verified Task 1–3 foundation (`9e206c1` to `origin/master`).

## Next

- [ ] **User:** create a free Supabase project and a Vercel project; put `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `PUBLIC_ORIGIN` in Vercel env vars (never in the repo).
- [ ] Verify the `postgres` driver path against a real Supabase database (`npm run db:migrate`, then the API on Vercel); only PGlite is covered by tests.
- [ ] Add revision-safe WebSocket broadcasting, reconnect snapshots, heartbeat, and exact 24-hour expiration cleanup (Task 4).
- [ ] Add Playwright multi-browser/restart tests and bounded demo load test (64 recipients; #65 gets `429 RECIPIENT_LIMIT`).
- [ ] Add Vercel config (`vercel.json`), setup/demo documentation, and update Project.md with verified results (replaces Docker packaging).
- [ ] Verify public HTTPS/mobile QR flow on Vercel.
