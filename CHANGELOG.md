# Changelog

## Unreleased

### 2026-10-10

- Added the provider-neutral project instructions in `AGENTS.md`.
- Added the durable cross-agent task handoff in `TODO.md`.
- Implemented the Node/TypeScript scaffold, grapheme-aware text partitioning, SQLite sessions/shares, HTTP text/image share APIs, deterministic image allocation, image validation/storage/rendering, and integration tests.
- Closed the Task 3 original-image exposure finding by moving the default data directory outside the Vite root, denying raw storage paths in Vite, and adding a direct static-server regression test. Verified with 31 tests, typecheck, build, and a clean Task 3 re-review. Commit/push is the remaining handoff action for this checkpoint.
