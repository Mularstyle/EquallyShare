# Changelog

## Unreleased

### 2026-10-10

- Added the provider-neutral project instructions in `AGENTS.md`.
- Added the durable cross-agent task handoff in `TODO.md`.
- Implemented the Node/TypeScript scaffold, grapheme-aware text partitioning, SQLite sessions/shares, HTTP text/image share APIs, deterministic image allocation, image validation/storage/rendering, and integration tests.
- Closed the Task 3 original-image exposure finding by moving the default data directory outside the Vite root, denying raw storage paths in Vite, and adding a direct static-server regression test. Verified with 31 tests, typecheck, build, and a clean Task 3 re-review. Pushed as commit `9e206c1` to `origin/master`.
- Recorded demo decisions (Vercel hosting, 64-person audience, no `.txt` upload, End share) and lowered the `MAX_RECIPIENTS` default from 256 to 64. Verified with 31 tests and typecheck. Flagged the Vercel vs SQLite/WebSocket conflict as a blocker before Task 4.
- Chose Vercel Functions + Supabase free plan (Postgres, private Storage, Realtime Broadcast) to replace SQLite/`ws`/Docker for hosting; documented in `docs/decisions.md`. No code ported yet.
- Ported the backend off `node:sqlite`/`DATA_DIR`: async SQL layer with a `postgres` adapter (Supabase, transaction pooler) and a PGlite adapter (tests/local dev); joins lock the share row; RLS enabled on all tables; originals stored as lossless PNG in a private Supabase Storage bucket (local disk when unconfigured) with an in-memory decode cache; join publishes `{ revision, status }` via Supabase Realtime Broadcast REST; Vercel entry `api/index.ts`, `vercel.json`, `npm run db:migrate`, `docs/setup.md`; upload default 4 MiB; removed `ws`. Verified with 34 tests, typecheck and server build. `vite build` still fails because `src/web/main.tsx` (Task 5) does not exist yet; the `postgres` adapter is untested against a live database.
