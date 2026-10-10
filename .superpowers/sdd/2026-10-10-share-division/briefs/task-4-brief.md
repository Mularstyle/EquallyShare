### Task 4: Add Revision-Safe Real Time and Exact Expiration

**Files:**

- Create: `src/server/realtime.ts`
- Create: `src/server/expiry.ts`
- Create: `tests/integration/realtime.test.ts`
- Modify: `src/server/app.ts`
- Modify: `src/server/share-service.ts`
- Modify: `src/server/index.ts`
- Modify: `src/shared/contracts.ts`

**Interfaces:**

- Consumes: authenticated membership/snapshots from Task 2 and revision-aware collage route from Task 3.
- Produces: per-member WebSocket delivery and expiration lifecycle used by Task 5 and all end-to-end tests.

```ts
export class RealtimeHub {
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void;
  publishShare(shareId: string): Promise<void>;
  publishExpired(shareId: string, expiresAt: string): void;
  close(): Promise<void>;
}

export class ExpiryService {
  start(): void;
  stop(): void;
  expireDue(now?: number): Promise<number>;
}
```

- [ ] Write failing tests with a fixed/fake clock:
  - `sends latest snapshot immediately after authenticated WebSocket connection`.
  - `broadcasts one new revision to every connected member after a new join` and sends each socket its own allocation.
  - `reconnect receives latest snapshot even when events were missed` without increasing recipient count.
  - `rejects unauthorized cookie, unjoined visitor, wrong origin and unknown share` with stable close/error codes.
  - `expires exactly at expiresAt without extension`: creation at T, join at T+23h59m, all HTTP/WS operations at T+24h return/emit expired.
  - `notifies pages already open when expiration sweep runs`.
  - `rejects stale collage after revision changes`, including render that started before join and finished after it.
  - `heartbeat terminates dead sockets without changing recipient count`.

```ts
it("expires exactly at expiresAt without extension", async () => {
  clock.set(CREATED_AT + hours(23) + minutes(59));
  await joinAsNewVisitor(shareId);
  clock.set(CREATED_AT + hours(24));
  await expiry.expireDue();
  expect((await joinAsNewVisitor(shareId)).status).toBe(410);
  await expectSocketEvent(ownerSocket).resolves.toMatchObject({ type: "expired", shareId });
  expect(await readExpiresAt(server.db, shareId)).toBe(CREATED_AT + hours(24));
});
```
- [ ] Run `npm test -- tests/integration/realtime.test.ts`; expected result is failure because hub/expiry services do not exist.
- [ ] Implement WebSocket upgrade on `/ws`. Validate exact configured Origin, valid session cookie, active share and existing membership before adding a socket to a room.
- [ ] Send a freshly computed snapshot on each successful connection. On a join, commit DB state first, then call `publishShare`; `publishShare` reads current state separately per connected visitor and sends a `snapshot` event.
- [ ] Add 30-second ping/pong heartbeat and remove dead sockets from memory only. Socket lifecycle must never modify database Recipient rows.
- [ ] Add an expiration sweep every second for active shares with `expires_at <= now`. Atomically mark them expired, broadcast `expired`, then delete their source file using its exact stored path. Keep `image_path` on an expired row while deletion is pending, retry bounded pending deletions on later sweeps, and set it null only after success; never recursively delete a computed directory.
- [ ] Enforce expiration on every HTTP/WS access independent of the sweep so boundary correctness does not depend on timer timing. Keep a tombstone row for seven days so an expired URL returns `410`, then purge tombstones in a separate bounded sweep.
- [ ] On shutdown, stop accepting upgrades, close sockets, stop timers and close SQLite after pending request handlers settle.
- [ ] Run real time integration tests and all tests accumulated so far; expected result is passing without hanging handles.
- [ ] Checkpoint: run tests with open-handle detection; inspect that broadcasts happen after commits and no socket count is used as recipient count.

