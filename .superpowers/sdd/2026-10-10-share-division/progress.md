# SDD ledger — plan: docs/superpowers/plans/2026-10-10-share-division.md

## Preflight

Ruling: The user supplied `Mularstyle/EquallyShare`; GitHub connector confirms it is an empty repository. This checkout is initialized locally with that repository as `origin`; implementation starts from the plan scaffold.

Ruling: The SDD helper scripts cannot run because the Windows MSYS bash process is denied `NtCreateDirectoryObject`. I will preserve the same artifact contract manually under this plan-scoped directory and use direct PowerShell/agent review packages. The user explicitly authorized commit/push after each completed task; Git operations remain focused and non-destructive.

## Shared-file and interface scan

| Pair | Shared surface | Finding / ruling |
| --- | --- | --- |
| Task 1 → Task 2 | `src/shared/contracts.ts`, `src/core/partition.ts` | Task 1 produces DTOs and grapheme partitioning; Task 2 consumes them. Compatible. |
| Task 2 → Task 3 | `src/server/share-service.ts`, `src/server/app.ts`, `src/server/config.ts` | Task 3 extends the service with image storage after Task 2 owns text/identity. Compatible; image method is intentionally added in Task 3. |
| Task 2 → Task 4 | DB/service snapshots | Task 4 reads committed membership and revision state. Compatible; broadcasts happen after join commit. |
| Task 3 → Task 4 | image route/render revision check | Task 4's stale-render event depends on Task 3's revision validation. Compatible. |
| Task 4 → Task 5 | `ServerEvent`, expiry and reconnect contract | Task 5 consumes the server event union and terminal expiry behavior. Compatible. |
| Task 5 → Task 6 | stable DOM test hooks and browser session behavior | Task 6 consumes explicit hooks and tests Web Locks in browser contexts. Compatible. |
| Task 6 → Task 7 | test harness/build/restart behavior | Task 7 adds production packaging after E2E harness proves the flows. Compatible. |
| Task 2 ↔ Task 3 | `StoredImage` | Task 2 keeps image creation abstract; Task 3 owns `StoredImage` and adds `createImage`, avoiding a forward dependency. |

## Task self-consistency scan

| Task | Files vs tests vs interfaces | Result |
| --- | --- | --- |
| 1 | Core partition and shared contracts are created before integration consumers. | Compatible |
| 2 | DB/session/share HTTP tests cover the methods and routes named in its interfaces. | Compatible |
| 3 | Pure collage tests precede image service/API tests; stored source is server-only. | Compatible |
| 4 | WebSocket/expiry tests cover the hub methods and event types it creates. | Compatible |
| 5 | Reducer tests cover state transitions; UI test hooks are declared before E2E. | Compatible |
| 6 | Browser helpers and load helper are declared before their E2E/load usage. | Compatible |
| 7 | Production smoke test names compiled serving/restart behavior and final docs. | Compatible |

Ruling: For one recipient, image allocation preserves the original full-image layout; for N>1, deterministic fragments are collaged. This resolves the only visual ambiguity in favor of the product's "divide by one" meaning.

Ruling: A truly first-time browser tab cannot be identified by the backend before it has a cookie. Web Locks serializes bootstrap in the client; backend idempotency covers all subsequent requests. Task 6 tests both layers separately.

## Task progress

Task 1: implementer dispatched; awaiting source/test report.
Task 1: complete (uncommitted workspace; review clean with Vitest EPERM caveat; empty-source boundary added).
Task 2: complete (uncommitted workspace; review clean after fix round 1; P3 cross-connection contention and expired-session cleanup deferred to maintenance; QR fallback contract carried into plan Tasks 3/5).
Task 3: complete after fix round 1 (review clean; image collage, validation, storage/rendering, recipient-only access, and Vite storage-visibility regression covered; 31 tests, typecheck, and build pass).

## Checkpoint handoff

- Scope pushed at this checkpoint: Tasks 1–3 plus project instructions and handoff documentation.
- Remaining work: Tasks 4–7 in the canonical plan; no later task started in this checkpoint.
- Remote commit SHA: `9e206c1` on `origin/master`.
- Verification at push: `npm test` (31 passed), `npm run typecheck`, `npm run build`; Task 3 re-review clean after the Vite storage-visibility fix.
