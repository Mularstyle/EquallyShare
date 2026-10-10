### Task 5: Build the Creator and Recipient Browser Experience

**Files:**

- Create: `src/web/main.tsx`
- Create: `src/web/App.tsx`
- Create: `src/web/CreatePage.tsx`
- Create: `src/web/SharePage.tsx`
- Create: `src/web/api.ts`
- Create: `src/web/share-state.ts`
- Create: `src/web/useShareChannel.ts`
- Create: `src/web/styles.css`
- Create: `tests/unit/share-state.test.ts`
- Modify: `index.html`
- Modify: `vite.config.ts`

**Interfaces:**

- Consumes: HTTP DTOs/routes from Tasks 1–3 and `ServerEvent` WebSocket behavior from Task 4.
- Produces: the browser flows and stable DOM hooks exercised by Task 6.

```ts
export type ShareViewState =
  | { status: "bootstrapping" }
  | { status: "joining" }
  | { status: "live"; snapshot: RecipientSnapshot }
  | { status: "reconnecting"; snapshot?: RecipientSnapshot }
  | { status: "expired"; expiresAt?: string }
  | { status: "missing" }
  | { status: "error"; message: string; retryable: boolean };

export type ShareAction =
  | { type: "snapshot"; snapshot: RecipientSnapshot }
  | { type: "connection-lost" }
  | { type: "expired"; expiresAt?: string }
  | { type: "missing" }
  | { type: "error"; message: string; retryable: boolean };

export function shareReducer(state: ShareViewState, action: ShareAction): ShareViewState;
export function ensureBrowserSession(signal?: AbortSignal): Promise<void>;
```

- [ ] Write failing reducer tests:
  - `accepts a newer revision and ignores older or duplicate snapshots`.
  - `keeps expired as terminal when late snapshot arrives`.
  - `retains last allocation while reconnecting and marks it stale`.
  - `ignores snapshots and image responses older than current revision` using an explicit image-request token/revision assertion.

```ts
it("accepts a newer revision and ignores older snapshots", () => {
  const current = liveState(snapshot({ revision: 4, recipientCount: 4 }));
  expect(shareReducer(current, { type: "snapshot", snapshot: snapshot({ revision: 3 }) })).toBe(current);
  expect(shareReducer(current, { type: "snapshot", snapshot: snapshot({ revision: 5 }) }))
    .toMatchObject({ status: "live", snapshot: { revision: 5 } });
});

it("keeps expired terminal when a late snapshot arrives", () => {
  expect(shareReducer({ status: "expired" }, { type: "snapshot", snapshot: snapshot({ revision: 9 }) }))
    .toEqual({ status: "expired" });
});
```
- [ ] Run `npm test -- tests/unit/share-state.test.ts`; expected result is failure because reducer does not exist.
- [ ] Implement pure reducer and API error mapping. The UI may retain a visibly marked old allocation during reconnect, but must remove it immediately upon expired/missing and must never label it current.
- [ ] Implement session bootstrap under `navigator.locks.request("share-session-bootstrap", ...)`; the first tab calls `/api/session`, later simultaneous tabs wait and then call idempotently with the cookie. If Web Locks is unavailable, show a clear unsupported-browser state rather than silently risk double counting.
- [ ] Implement `/` Creator flow with two input modes: textarea for text and file picker for image. Validate required input client-side while treating server validation as authoritative. Disable duplicate submit while request is pending.
- [ ] After create, show the Creator's current allocation as the main content, plus share URL, copy button and QR. Do not keep the full upload preview as the main result after creation.
- [ ] If `qrStatus` is `"unavailable"`, keep the share URL/copy control fully usable and show a compact QR-unavailable message instead of rendering a broken image; the recipient URL flow remains unchanged.
- [ ] Implement `/s/:shareId`: bootstrap session, idempotent join, display recipient number, cumulative recipient count, expiry time and allocation, then open WebSocket.
- [ ] Expose stable UI test hooks `recipient-number`, `recipient-count`, `text-allocation`, `image-allocation`, `share-status`, `share-url` and `qr-code`; keep visible labels accessible to screen readers and use hooks only where role/text selectors would be ambiguous.
- [ ] For text allocation with `unitCount=0`, show exact UI copy `คุณได้รับข้อมูล 0 ตัวอักษร`; retain recipient/count context and treat state as live.
- [ ] For image snapshots, abort an older fetch, request `imageUrl` containing the revision, decode to a Blob URL, and apply only if the request revision still equals reducer revision. Revoke replaced Blob URLs. A zero allocation shows a normal zero-pixel message and no broken `<img>`.
- [ ] Implement reconnect schedule 0.5s, 1s, 2s, 4s then 5s capped. Each reconnect repeats session bootstrap and idempotent join before WebSocket; a fresh server snapshot closes missed-event gaps.
- [ ] Style a responsive, touch-friendly single-column mobile layout and wider desktop result layout. Include loading, joining, live, reconnecting, invalid input, missing, expired, recipient-limit and retryable server-error states. No animation is required.
- [ ] Configure Vite local proxy for `/api` and `/ws`; keep all production requests same-origin.
- [ ] Run reducer tests, `npm run typecheck` and `npm run build`; expected result is passing tests and successful client/server compilation.
- [ ] Checkpoint: inspect generated client bundle strings/network calls to confirm no server filesystem path, original image payload or visitor ID control is present.

