# Task 3 review — deterministic image collage

Status: **Pass after fix round 1.** The P1 finding is resolved; no remaining P1/P2/P3 finding was identified in the scoped re-review.

## Findings

### P1 — Vite serves the complete stored original from the default data directory

**Resolved.** `loadConfig()` now defaults to `../equallyshare-private-data`, outside Vite's project root. `vite.config.ts` disables `publicDir` and denies `originals` contents, `.rgba` files, and SQLite files when a custom data directory is under the root. A new Vite integration test requests a raw original and a temporary sibling inside the project root; both return 403 without source bytes. The test also asserts the default data location lies outside the root.

Before the fix, `loadConfig()` defaulted `DATA_DIR` to `./data` (`src/server/config.ts`), while `vite.config.ts` set the served root to `.`. `ImageService` wrote the canonical original to `DATA_DIR/originals/<shareId>.rgba`. The share ID was present in every share URL and snapshot. During the planned `npm run dev` flow, a browser could request `/data/originals/<shareId>.rgba` from the Vite port and receive the complete original, bypassing recipient allocation. This violated the explicit original-image isolation requirement.

Reproduction: started Vite with a marker file at `data/originals/probe-review.rgba`; `GET /data/originals/probe-review.rgba` returned HTTP 200 with the exact `original-probe` file bytes. The probe file and directories were removed afterward. The existing Express-only integration test returns 404 for `/originals/<id>.rgba`, but it does not cover Vite's static file server.

Fix direction: place persistent originals outside every web-served root by default and enforce that boundary in configuration, or explicitly deny `DATA_DIR` and `/data` in the Vite server and add a regression test against the actual development server. Check production static-serving plans for the same boundary. The source UUID remains public via the share ID, so obscurity is not a mitigation.

The production server must preserve this boundary when its static-serving entrypoint is implemented in a later task; that is a future integration requirement, not an open Task 3 finding.

## Reviewed behavior

- Pure collage allocation covers each source pixel exactly once for tested dimensions and recipient counts, uses the specified q/r rule, and preserves full layout at N=1. Destination rectangles do not overlap.
- Sharp validation rejects spoofed MIME, corrupt/animated/oversized input and decoded pixel bombs in the integration tests. Uploaded files are stored as server-generated filenames; a failed database creation removes the orphan.
- The Express collage route derives recipient identity from the session cookie, returns `private, no-store`, handles busy rendering with 503, and rejects stale revisions before and after rendering. Expiry is checked via `getSnapshot()` after rendering.
- Image creation uses the nullable QR fallback contract; text sharing tests still pass. No additional P1/P2 code finding was identified in these paths.

## Verification

- `npm test -- tests/unit/collage.test.ts tests/integration/images.test.ts`: 10 passed.
- `npm test`: 29 passed across 4 files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Vitest initially failed before collection with sandbox `EPERM` reading `node_modules/vitest/dist/spy.js`; the permitted rerun passed. The Vite exposure probe was also rerun outside the network sandbox and returned 200.

## Re-review verification

- `npm test -- tests/integration/storage-visibility.test.ts tests/integration/images.test.ts`: 8 passed. Both direct Vite requests for source and temporary files returned 403.
- `npm run typecheck`: passed.
- `npm run build`: passed.
