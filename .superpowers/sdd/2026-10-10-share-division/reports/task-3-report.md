# Task 3 — deterministic image collage

Status: complete. No commit or push was made by this implementer; the controller owns Git operations.

## Changes

- Added `src/core/collage.ts`. A 32×32 boundary grid omits empty cells, SHA-256 sorts tiles by share ID, and contiguous q/r ranges allocate each source pixel exactly once. Partial tiles become row rectangles; a deterministic shelf layout places owned fragments without scaling. One recipient gets a single rectangle in the original layout. Empty allocations have zero dimensions and fragments.
- Added `src/server/image-service.ts`. Sharp accepts PNG, JPEG and static WebP, checks decoded metadata and the 12-megapixel limit, applies EXIF orientation, caps the longest edge at 1024 pixels, and stores canonical RGBA under `DATA_DIR/originals/<generated UUID>.rgba`. Files are written to a temporary sibling then renamed. Render output copies only owned rows into a transparent buffer and encodes a PNG. Explicit filename validation and containment checks guard reads and deletion.
- Extended `ShareService` with transactional image creation, image snapshots, and member-only image lookup. The immutable source filename and dimensions remain in SQLite; snapshots contain only recipient allocation metadata and a revision-bound collage URL.
- Added multipart `POST /api/shares/image` and authenticated `GET /api/shares/:shareId/collage?revision=N`. Uploads use Multer memory storage, one-file and byte limits, MIME/signature agreement, and cleanup on database failure. Image creation uses the same nullable QR fallback as text. Collage responses use `private, no-store`, a four-slot render limit with `503 RENDER_BUSY`/`Retry-After`, and revision/expiry checks before and after rendering.
- Added pure and integration tests covering pixel ownership, fairness, deterministic layout, EXIF orientation, unique-color pixel isolation, invalid and animated input, upload and decoded-size limits, orphan cleanup, zero allocation, membership, stale revision, render saturation, and source path isolation.
- Closed a storage exposure found in review: the default `DATA_DIR` now resolves to `../equallyshare-private-data`, outside Vite's project root. Vite also denies `originals` contents and SQLite files, including raw and temporary source files when a custom data directory is placed under the project. `publicDir` is disabled so it cannot bypass that deny rule. The example environment file uses the safe default.

## Verification

- `npm test`: 31 tests passed across 5 files after the storage fix.
- `npm test -- tests/integration/images.test.ts`: 6 tests passed after the final test typing change.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Checked generated server output and integration HTTP responses for source paths. No browser client assets exist yet; the only built references to `.rgba` and `originals` are server-side. Test data directories are removed by the harness.
- A Vite integration regression starts the dev server and requests both a raw `.rgba` file and a temporary `.tmp` source file from inside the project root. Both requests return `403` without source bytes; the default configured data directory is separately asserted to be outside that root.

Vitest had to run outside the filesystem sandbox because the sandbox denied `realpath` access to the installed `vitest/dist/spy.js` before test collection. This was an environment permission failure, not a test failure.

## Handoff

- Task 4 can use `ImageService.deleteSource()` for expiry cleanup and the revision-aware collage route for stale-render tests.
- The current single-process semaphore and synchronous SQLite transactions match the planned single-instance runtime.
