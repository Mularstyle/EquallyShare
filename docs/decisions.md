# Technical Decisions

## Node 22 and Built-in SQLite

- Context: The MVP needs persistent state for cumulative recipients and restartable shares without a separate database service.
- Decision: Use Node 22 `node:sqlite` `DatabaseSync` with a persistent local data directory on one server process.
- Reason: It is available in the verified runtime and keeps the hackathon deployment small.
- Alternatives: `better-sqlite3`, a hosted database, or in-memory state.
- Consequences: Node 22 must remain pinned; multi-instance deployment and high-scale concurrency are outside the MVP.

## Browser Identity

- Context: Refreshes and multiple tabs in one browser must not create duplicate Recipients.
- Decision: Use an opaque HttpOnly cookie mapped to a server-side visitor ID, and serialize first-time browser bootstrap with Web Locks.
- Reason: The browser cannot prove human identity, but this gives deterministic same-browser behavior without exposing a client-controlled visitor ID.
- Alternatives: localStorage-only IDs, accounts, IP address, or one WebSocket connection per Recipient.
- Consequences: A new browser/device or cleared cookie may count as a new Recipient; this is an intentional MVP limitation.

## Deterministic Image Collage

- Context: Every image Recipient needs scattered fragments, exact ownership, and stable refresh behavior.
- Decision: Shuffle a fixed source tile stream by share ID, allocate exact pixel intervals, and pack each Recipient's rectangles into a collage. Preserve the original layout when N=1.
- Reason: It gives a visible collage mechanic while allowing tests to prove no pixel overlap or loss.
- Alternatives: random crops, a single strip, or a client-side full image with CSS masking.
- Consequences: Rendering cost grows with recipients; image limits and a render semaphore protect the single-process demo.


## Demo Product Decisions (2026-10-10)

- Context: Project.md listed open decisions on hosting, audience size, `.txt` upload and ending a share early.
- Decision: Host on Vercel; expected audience is 64, so `MAX_RECIPIENTS` defaults to 64; text input stays type/paste only (no `.txt` upload); the Creator gets an End share action that closes the share before the 24-hour expiry.
- Reason: User decision for the hackathon demo.
- Alternatives: Container host with persistent volume; 256-recipient default; `.txt` upload; one new share per demo round instead of End share.
- Consequences: Load test targets 64 joins and expects #65 to get `429 RECIPIENT_LIMIT`. End share needs a Creator-only endpoint, an `ended` share status that rejects joins, and a realtime broadcast to open pages. Vercel conflicts with the single-process SQLite + `ws` design (no persistent disk, no long-lived WebSocket server); the storage/realtime approach must be chosen before Task 4 and recorded here.

## Vercel + Supabase Free Tier (2026-10-10)

- Context: Hosting must be Vercel (see above), which has no persistent disk and no long-lived WebSocket server, so the single-process SQLite + `ws` + `DATA_DIR` design cannot run there. The user chose to move everything onto hosted services and required free ones.
- Decision:
  - Backend: Vercel Functions (Node runtime, Hobby plan) serve the existing HTTP API. Business rules stay in `src/core`; `src/server` services are ported from `node:sqlite` to Postgres.
  - Database: Supabase Postgres (free plan). Joins run in a transaction that locks the share row (`SELECT ... FOR UPDATE`) to keep idempotent, ordered recipient registration.
  - Images: Supabase Storage, private bucket, accessed only by the backend with the service-role key. Collages are still rendered server-side with Sharp; originals never reach the browser.
  - Realtime: Supabase Realtime Broadcast, one channel per share. The backend publishes only `{ revision, status }`; browsers then refetch their own snapshot over HTTP. No content is broadcast.
  - Expiry and End share: enforced on every read/join from `expires_at`/`ended_at`; open pages learn via a broadcast (End share) or a client timer from `expiresAt` (expiry). Storage cleanup runs from a daily Vercel Cron job (the Hobby plan only allows daily cron).
  - Upload limit drops from 5 MiB to 4 MiB because Vercel Functions reject request bodies over 4.5 MB.
- Reason: Supabase's free plan covers database, file storage and realtime in one project (about 500 MB DB, 1 GB storage, 200 concurrent realtime connections), which is enough for a 64-person demo, and Vercel Hobby is free.
- Alternatives: Neon/Upstash + Vercel Blob + Pusher/Ably (more services to wire up); polling instead of Realtime; Vercel frontend + separate Node host (rejected by user).
- Consequences: `node:sqlite`, `DATA_DIR` and the Docker/persistent-volume tasks are replaced. Free Supabase projects pause after 7 days without activity; restore the project from the dashboard before a demo. Free plans have no backups, which is acceptable for 24-hour demo shares. Secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, anon key) live in Vercel environment variables, never in the repo. Free-tier numbers come from third-party summaries; confirm them on supabase.com/pricing when creating the project.

## Backend Port Details (2026-10-10)

- Context: Implementing the Vercel + Supabase decision while keeping the Task 1–3 tests meaningful without a cloud account.
- Decision: A small async `Sql` interface with two adapters: `postgres` (Supabase, `prepare: false` for the transaction pooler) and embedded PGlite (tests and local dev, on disk under `DATA_DIR` or in memory). `ImageStore` has Supabase Storage and local-disk implementations chosen by config. Originals are stored as lossless PNG, and decoded originals are cached in function memory (6 images). Row level security is enabled on all tables with no policies.
- Reason: PGlite is real Postgres, so row locks, constraints and triggers behave as in production and tests need no server. PNG plus the cache keeps storage egress small: a 64-person image demo re-renders collages roughly 2,000 times, which at 4 MB of raw RGBA per download would exceed the free plan's monthly egress. RLS stops the browser-visible anon key from reading tables through Supabase's auto-generated REST API.
- Alternatives: A Docker Postgres for tests; storing raw RGBA; supabase-js queries instead of SQL.
- Consequences: Tests do not exercise the `postgres` driver itself; verify it once against Supabase. The render-concurrency limit and image cache are per function instance.
