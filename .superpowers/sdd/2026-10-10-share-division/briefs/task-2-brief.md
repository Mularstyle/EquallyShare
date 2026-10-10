### Task 2: Persist Browser Identity, Shares and Idempotent Joins

**Files:**

- Create: `src/server/config.ts`
- Create: `src/server/db.ts`
- Create: `src/server/identity.ts`
- Create: `src/server/share-service.ts`
- Create: `src/server/app.ts`
- Create: `tests/integration/test-server.ts`
- Create: `tests/integration/shares.test.ts`
- Modify: `src/shared/contracts.ts`
- Modify: `.env.example`

**Interfaces:**

- Consumes: `partitionText()` and shared DTOs from Task 1.
- Produces: persistent database/session/share services and disposable test server used by Tasks 3–7.

```ts
export type Clock = () => number;
export type VisitorId = string;

export function openDatabase(path: string): DatabaseSync;
export function migrateDatabase(db: DatabaseSync): void;

export type SessionResult = {
  visitorId: VisitorId;
  token: string;
  isNew: boolean;
};

export class IdentityService {
  ensureSession(rawToken: string | undefined): SessionResult;
}

export class ShareService {
  createText(visitorId: VisitorId, text: string): RecipientSnapshot;
  join(shareId: string, visitorId: VisitorId): JoinResult;
  getSnapshot(shareId: string, visitorId: VisitorId): RecipientSnapshot;
}

export type JoinResult = {
  snapshot: RecipientSnapshot;
  joined: boolean;
};

export type TestServer = {
  origin: string;
  db: DatabaseSync;
  close(): Promise<void>;
};
export function startTestServer(options?: {
  clock?: Clock;
  dataDir?: string;
}): Promise<TestServer>;
```

SQLite minimum schema:

- `sessions(token_hash PRIMARY KEY, visitor_id UNIQUE, created_at, last_seen_at, expires_at)`
- `shares(id PRIMARY KEY, content_type, original_text NULL, image_path NULL, image_width NULL, image_height NULL, created_at, expires_at, recipient_count, revision, status)`
- `recipients(share_id, visitor_id, join_order, joined_at, PRIMARY KEY(share_id, visitor_id), UNIQUE(share_id, join_order))`

- [ ] Write failing integration tests against a disposable SQLite file and fixed clock:
  - `creates creator as recipient one at revision one` and returns N=1 allocation.
  - `joins new visitors in stable order and recomputes canonical text` through N=4.
  - `refresh, reconnect and repeated join keep the same count and revision`.
  - `reuses the server session cookie idempotently`: call `/api/session`, reuse its cookie for concurrent session/join requests and assert one visitor and one recipient row. A backend cannot identify two truly cookieless concurrent requests as the same browser; Task 6 owns that browser-side Web Lock race test.
  - `serializes different concurrent visitors without duplicate join order`: all responses have unique `recipientNumber`; DB count and revision increase exactly once per new visitor.
  - `persists active share, session and order after database reopen`.
  - `rejects empty text and text above configured grapheme limit` with stable code/status and no share row.

```ts
it("reuses the server session cookie idempotently", async () => {
  const cookie = await createSession(server.origin);
  const created = await createTextShare(server.origin, cookie, "ABCDEFGH");
  const [left, right] = await Promise.all([
    joinShare(server.origin, cookie, created.shareId),
    joinShare(server.origin, cookie, created.shareId),
  ]);
  expect(left.recipientNumber).toBe(1);
  expect(right.recipientNumber).toBe(1);
  expect(left.recipientCount).toBe(1);
  expect(countRows(server.db, "recipients")).toBe(1);
});
```
- [ ] Run `npm test -- tests/integration/shares.test.ts`; expected result is failure due to missing services/routes.
- [ ] Implement config parsing for `PORT`, `PUBLIC_ORIGIN`, `DATA_DIR`, `SESSION_TTL_HOURS`, `MAX_TEXT_GRAPHEMES`, `MAX_RECIPIENTS`, upload/image/render limits. Reject invalid values at startup; defaults include 24-hour share TTL and a session TTL of 7 days.
- [ ] Implement migrations idempotently and enable SQLite foreign keys, WAL mode and busy timeout. All share creation/join transitions run in a synchronous `BEGIN IMMEDIATE` transaction with no file/network/Sharp work inside it.
- [ ] Implement `IdentityService` with random token generation, SHA-256 storage, HttpOnly cookie, `SameSite=Lax`, path `/`, and `Secure` when `PUBLIC_ORIGIN` is HTTPS. Returning a valid cookie updates `last_seen_at` without changing `visitorId`.
- [ ] Add `POST /api/session` and a client contract: browser must serialize first-time bootstrap across tabs with Web Locks in Task 5. Server accepts existing cookie idempotently; it never accepts a visitor ID chosen by client.
- [ ] Implement text share creation and join. Creation atomically inserts share and Creator recipient with `recipient_count=1`, `revision=1`; a genuinely new join increments both once; an existing member returns current snapshot unchanged.
- [ ] Implement snapshot lookup by cookie membership. Map validation/not-found/expired/limit failures to the HTTP table without exposing paths, SQL or stack traces.
- [ ] Build `shareUrl` from validated `PUBLIC_ORIGIN`, never request Host headers. Add QR generation only to create responses; do not persist QR data.
- [ ] Run `npm test -- tests/integration/shares.test.ts` and `npm run typecheck`; expected result is passing identity, transaction, persistence and HTTP assertions.
- [ ] Checkpoint: inspect DB file after a test run and confirm raw session token, QR, original image data and recipient allocations are not persisted in the wrong tables.

