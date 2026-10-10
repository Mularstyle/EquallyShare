# Changelog

## Unreleased

### 2026-10-10

- Added the provider-neutral project instructions in `AGENTS.md`.
- Added the durable cross-agent task handoff in `TODO.md`.
- Implemented the Node/TypeScript scaffold, grapheme-aware text partitioning, SQLite sessions/shares, HTTP text/image share APIs, deterministic image allocation, image validation/storage/rendering, and integration tests.
- Closed the Task 3 original-image exposure finding by moving the default data directory outside the Vite root, denying raw storage paths in Vite, and adding a direct static-server regression test. Verified with 31 tests, typecheck, build, and a clean Task 3 re-review. Pushed as commit `9e206c1` to `origin/master`.
- Recorded demo decisions (Vercel hosting, 64-person audience, no `.txt` upload, End share) and lowered the `MAX_RECIPIENTS` default from 256 to 64. Verified with 31 tests and typecheck. Flagged the Vercel vs SQLite/WebSocket conflict as a blocker before Task 4.
