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

## Deterministic Image Collage (superseded 2026-10-10 by Image Grid Split)

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

## Image Grid Split (2026-10-10)

- Context: The user found the scattered 32×32 tile collage too scrambled and asked for a grid split instead, choosing "one block per person".
- Decision: Split the image into N near-square cells (`rows = round(sqrt(N × height / width))`, clamped to 1..N; the first `N % rows` rows get one extra cell). Recipient #1 gets the top-left cell, then reading order. Each Recipient's portion is that one rectangle, shown unshuffled. Boundaries round up so earlier Recipients keep leftover pixels, matching the text split.
- Reason: Each person sees a recognizable piece of the real picture, and the pieces visibly fit back together on a demo screen.
- Alternatives: Keeping scattered tiles at their real positions; a regular round-robin tile pattern; a plain N-column strip split.
- Consequences: Replaces `createTileStream`/`allocateCollage` with `allocateGridCell`; shares are no longer equal to the pixel (cells differ by at most one row/column of pixels, and rows with an extra cell have narrower cells). `fragmentCount` is now 1, or 0 for an empty cell. The confirmed requirement in Project.md is updated.

## MP3 Audio Shares (2026-10-10)

- Context: The user asked for MP3 support. Audio was out of the MVP scope, and Vercel Functions have no ffmpeg.
- Decision: Accept MP3 only. Parse MPEG audio Layer III frame headers in `src/core/mp3.ts`, drop ID3 tags and the Xing/Info frame, and store only the audio frames. Divide frames like text: contiguous time segments in join order with the shared `partitionRange` rule. Serve each Recipient a standalone MP3 of their frames. Reuse the private store and the `image_path` column for the original's key; add `audio_frame_count`, `audio_sample_rate`, `audio_samples_per_frame`.
- Reason: Frames are independently decodable units (~26 ms), so cutting at frame boundaries needs no decoder and runs in plain JavaScript on Vercel. Time segments are the natural audio analogue of the confirmed text rule.
- Alternatives: Decode and re-encode with ffmpeg (heavy, not on Vercel); interleaving short slices (unlistenable); accepting other formats (needs a decoder per format).
- Consequences: The first frame of a segment can glitch slightly because MP3 frames may borrow bits from earlier ones (bit reservoir). Mixed-sample-rate or free-format MP3s are cut at the first inconsistent frame or rejected. The live database needed an additive migration (applied 2026-10-10).

## MP4 Video Shares (2026-10-10)

- Context: The user asked for MP4 support, chose time segments (not a spatial grid) and an upload limit of 50 MB.
- Decision: Browser → Supabase Storage direct upload with a signed upload URL, reserved through a `pending_uploads` row tied to the visitor. The server reads keyframes from the MP4 `stss`/`stts` tables with a small parser (`src/core/mp4.ts`), divides keyframe-to-keyframe GOPs with `partitionRange`, and cuts each range with `ffmpeg-static` stream copy limited by an exact frame count. Cuts are cached in storage per GOP range (`segments/<share>/g<start>-<count>.mp4`), stale ranges are deleted, and recipients get a 10-minute signed download URL via a 302 from the API.
- Reason: Vercel rejects request and response bodies above 4.5 MB, so large files must bypass the function both ways; signed URLs also give players range requests. Stream copy keeps cuts fast and lossless; the frame-count limit stops B-frame reordering from leaking the next range's keyframe into a cut.
- Alternatives: Spatial grid (needs re-encoding every block per join); mp4box.js (new 2.x API, only keyframe times were needed); re-encoding to H.264 (too slow on free CPU).
- Consequences: Split precision follows keyframe spacing. HEVC uploads are accepted but may not play in every browser. Storage holds the original plus roughly one copy of it in cached cuts per video share; each join makes everyone re-download their new segment, which counts against Supabase's free egress (~5 GB/month), so short clips are best for demos. Vitest timeouts were raised to 30 s because integration tests now run ffmpeg and embedded Postgres in parallel.

## PDF Shares (2026-10-10)

- Context: The user asked for PDF support after MP3 and MP4.
- Decision: Divide by pages, the natural unit, with the shared `partitionRange` rule. Use the existing 4 MiB multipart upload. The server validates with pdf-lib (including the page tree, since pdf-lib loads leniently) and builds each Recipient's PDF from only their pages with `copyPages`. The browser renders pages with pdf.js 4.10 (legacy build, loaded on demand) using the `print` intent, which renders without requestAnimationFrame.
- Reason: Pages are what people expect to divide. A per-recipient PDF keeps the "no full original in the page" rule. Many phone browsers (notably Android Chrome) cannot show PDFs inline, so pdf.js canvases are needed; the print intent keeps rendering working in background tabs.
- Alternatives: Server-side rasterizing to images (needs a native canvas on Vercel); the browser's built-in PDF viewer (not on Android); 50 MB direct upload (more moving parts; PDFs are usually small).
- Consequences: Encrypted PDFs are rejected. Page shares are only as even as the page count allows. pdf.js adds about 380 KB plus a 1.4 MB worker, loaded only when a PDF share is opened. Unhandled API errors are now logged with their route so Vercel function logs show the cause.
