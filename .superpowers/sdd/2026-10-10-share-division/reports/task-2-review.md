# Task 2 review — persistent identity and text shares

## Spec verdict

**Substantially implemented, with one explicit test requirement still incomplete.** The text paths match the Task 2 service and HTTP contracts: Creator is recipient #1 at revision 1; each new visitor atomically receives the next order and increments count/revision; repeated joins preserve both. `BEGIN IMMEDIATE`, a database uniqueness constraint on `(share_id, visitor_id)` and `(share_id, join_order)`, and synchronous handlers provide the required single-process serialization. Expiry is denied at `now >= expires_at`, without extension on join. Session tokens are random, stored as SHA-256 hashes, and issued as HttpOnly, SameSite=Lax, path `/` cookies with `Secure` on an HTTPS public origin. `shareUrl` and QR use validated `PUBLIC_ORIGIN`, rather than the request Host header. Current HTTP status/code mappings agree with the Task 2 rows of the planned HTTP table.

The named `reuses the server session cookie idempotently` test exercises concurrent joins only; the brief expressly requires concurrent **session and join** requests reusing one cookie. The implementation appears idempotent, but that part of the acceptance test is missing.

## Quality verdict

**Core design is sound for the specified single Node process.** SQL is parameterized, writes are in short synchronous transactions, and member snapshots derive text from the immutable original. The database schema and `RecipientSnapshot`/`CreateShareResponse` types leave the expected extension points for Task 3 image work and Task 4 realtime/expiry work. The remaining concerns are test coverage, failure handling after a committed creation, and long-term session cleanup. No source files were changed in this review.

## Findings by severity

### P2 — QR failure turns a committed creation into an unrecoverable HTTP 500

`src/server/app.ts:49-53` commits `shares.createText()` before awaiting `QRCode.toDataURL()`. If QR generation rejects (for example, an unusually long but otherwise valid `PUBLIC_ORIGIN` exceeds QR capacity), the route returns `500 INTERNAL_ERROR` even though the share and Creator row already exist. I confirmed `qrcode` rejects a valid HTTPS origin with 50 DNS labels of 60 characters each with `The amount of data is too big to be stored in a QR Code`. A retry creates another share, and the client never receives the first share ID. Generate/validate the QR before committing once the share ID is known, or return a usable creation response with a documented QR fallback. Cover the failure path with a controlled QR failure or a bounded origin/config test. This is a create-response consistency issue, not a transaction or join-order issue.

### P2 — The required concurrent session reuse assertion is absent

`tests/integration/shares.test.ts:80-87` first creates one session, then concurrently sends only two join requests. `:69-77` tests a sequential session refresh. Add two concurrent `POST /api/session` calls carrying the same cookie, assert both return the same cookie, and then concurrently join with it. Assert exactly one session row and one recipient row, plus unchanged revision/count; the database row provides the visitor ID check because the API does not return it. The current code in `src/server/identity.ts:11-17` is consistent with this behavior, but the test does not prove it.

### P2 — No HTTP tests cover Origin enforcement or cookie attributes

`src/server/app.ts:24-28,34-38` implements exact Origin comparison and cookie flags, but all HTTP integration requests omit `Origin` and tests retain only the cookie's name/value (`tests/integration/shares.test.ts:22-25`). Add requests with the configured Origin and a foreign Origin to verify `403 ORIGIN_NOT_ALLOWED` and no mutation; assert `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` with HTTPS `PUBLIC_ORIGIN`. Also cover missing/invalid cookie, unknown share, expired snapshot, and recipient limit status/code mapping. The current helper's transport origin (`127.0.0.1:<ephemeral port>`) intentionally differs from `PUBLIC_ORIGIN` (`localhost:3000`), so a realistic browser-Origin request requires a configurable test public origin or a dedicated harness case. Task 4 must apply the same exact check to WebSocket upgrades; the Express middleware does not cover upgrades.

### P3 — The concurrent-join test proves single-server behavior, but not cross-connection SQLite contention

`tests/integration/shares.test.ts:89-98` launches twelve fetches concurrently against one synchronous Node handler and one `DatabaseSync` connection. It confirms unique orders and final revision for the deployment shape in the plan. It does not exercise two SQLite connections waiting on the same database file or `busy_timeout` behavior. A focused two-connection test would strengthen the database concurrency claim if Task 6 load/restart checks reveal contention. This is not a multi-instance requirement.

### P3 — Expired session rows have no deletion path

`src/server/identity.ts:11-24` creates a new row after a token expires, leaving the expired row in `sessions`. The Task 4 expiry plan sweeps shares, but currently describes no session cleanup. Repeated fresh/expired sessions can grow SQLite indefinitely. Add bounded expiry cleanup to the later maintenance sweep, without deleting active sessions. This does not affect 24-hour share expiry or idempotent joins.

## Contract and boundary notes for Tasks 3/4

- `src/server/share-service.ts:69-80` throws for image shares today. Task 3 must extend snapshot construction for `ImageAllocation`; until then, any image row routed through `join()` or `getSnapshot()` becomes a generic 500. This is expected unfinished Task 3 work, not a Task 2 regression.
- `src/server/share-service.ts:33-44` exposes `JoinResult.joined`, while the HTTP route returns only `RecipientSnapshot`. Task 4 can use the service result to publish a revision only after commit; it should not publish for repeated joins. The current HTTP route has no publish hook yet.
- `status='active'` may remain in SQLite after wall-clock expiry until Task 4's sweep, but `join()` and `getSnapshot()` reject it using the clock. Task 4 owns marking tombstones and notifying already-open pages.
- `startTestServer()` fixes `PUBLIC_ORIGIN` to `http://localhost:3000` and serves on an ephemeral `127.0.0.1` port. This verifies Host independence but cannot be used directly as a same-origin browser fixture for Task 4/5 without an option to align those origins.

## Tests and evidence

- `npm test -- tests/integration/shares.test.ts`: **9 passed** when rerun outside the local sandbox. The sandboxed attempt failed before test collection with `EPERM` resolving `node_modules/vitest/dist/spy.js`; that is an environment access error, not a test failure.
- `npm run typecheck`: **passed** for client/test and server TypeScript configurations.
- Source inspection confirms WAL, foreign keys and busy timeout at `src/server/db.ts:5-9`; atomic create/join operations at `src/server/share-service.ts:25-44`; token hashing and fixed session expiry at `src/server/identity.ts:11-37`; and generic error responses at `src/server/app.ts:68-82`.
- The token/QR database audit test checks session/share rows, but it does not inspect recipient rows or the SQLite file itself. The current schema does not contain allocation columns, so source inspection supports the intended storage boundary more strongly than that assertion alone.

## Re-review after fix round 1

**Verdict: prior P2 findings addressed; no new runtime regression found.** The text-create route now catches QR generation failure after the database commit and returns `201` with `shareUrl`, `snapshot`, `qrDataUrl: null`, and `qrStatus: "unavailable"` (`src/server/app.ts:49-54`). The long-origin integration test reproduces the QR library failure and confirms the created share remains joinable at revision 1 with one database row. The response remains useful to a client because it carries the share ID and link; the test does not establish that the deliberately oversized synthetic hostname itself can resolve through DNS.

The named idempotency test now runs two concurrent `POST /api/session` requests with the same cookie, checks both cookies and the one-row session invariant, then runs concurrent joins and checks one recipient with unchanged count/revision (`tests/integration/shares.test.ts:81-104`). New cases exercise allowed and foreign Origins, rejected requests without mutation, cookie flags for HTTP/HTTPS public origins, missing/invalid cookies, unknown share, expired snapshot and recipient-limit status/code mappings (`:174-241`). These checks close the three prior P2 coverage gaps.

The nullable QR contract is explicit in `src/shared/contracts.ts:35-40`, and the updated Task 2 report instructs the future browser UI to show QR only when `qrStatus` is `ready` while keeping the URL visible. **Handoff follow-up (P3):** the canonical implementation plan's HTTP table still describes the old shape `{ shareUrl, qrDataUrl, snapshot }` and its Task 5 UI instructions say to show a QR without documenting the unavailable state. Update that plan or the Task 5 brief before UI implementation, and apply the same fallback to Task 3's image-create route so both create paths satisfy `CreateShareResponse`. This is a documentation/downstream integration risk; no current UI exists to break.

The earlier P3 observations remain: the concurrent-join test uses one Node process/SQLite connection, and expired session rows have no cleanup path. Neither blocks this Task 2 handoff under the stated deployment scope. QR errors are intentionally swallowed to preserve the committed creation; adding server-side logging would improve diagnosis later without exposing details in the API response.

**Independent verification:** targeted Task 2 suite **13/13 passed**, full existing suite **19/19 passed**, and `npm run typecheck` passed. Tests ran outside the local sandbox because Vitest still hits the known `EPERM` dependency-read error inside it. I inspected the actual source and tests; Git reports the project files as untracked, so `git diff` cannot show a meaningful source diff. No source files or commits were changed in this re-review.
