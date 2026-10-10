# Share แปลว่าหาร Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างเว็บ MVP ที่ให้ Creator แชร์ข้อความหรือภาพผ่าน URL/QR แล้วข้อมูลของทุก Recipient ถูกหารใหม่แบบ real time ตามจำนวนผู้รับสะสม โดย Creator นับเป็นคนแรกและ share หมดอายุใน 24 ชั่วโมง

**Architecture:** ใช้แอป TypeScript หนึ่งชุด: React/Vite สำหรับหน้าเว็บ และ Express/WebSocket สำหรับ HTTP กับ real time โดย server เป็นแหล่งข้อมูลหลักของ recipient order, revision และ allocation ทั้งหมด ใช้ SQLite กับ local data directory เพื่อให้ share อยู่รอดหลัง restart บน single instance; ภาพจะถูก normalize เป็น pixel buffer ฝั่ง server และส่งเฉพาะ collage ของ Recipient ปัจจุบัน

**Tech Stack:** Node.js 22, TypeScript, React, Vite, Express 5, `ws`, Node `node:sqlite` (`DatabaseSync`), Sharp, Multer 2, `qrcode`, Vitest และ Playwright

**Spec:** [`Project.md`](../../../Project.md)

## Global Constraints

- พฤติกรรมที่ยืนยันแล้วใน `Project.md` มีสิทธิเหนือ implementation defaults ในแผนนี้
- MVP รองรับ text และ image เท่านั้น ไม่มี animation, sound, account, edit-in-place หรือ end/reset share
- Creator เป็น Recipient #1 และได้รับ allocation ด้วยกฎเดียวกับทุกคน
- Recipient count เป็นจำนวนสะสม การปิด tab หรือ disconnect ไม่ลดจำนวน
- browser identity เดิม refresh/reconnect/เปิดหลาย tab ต้องไม่เพิ่มจำนวน Recipient
- ทุก allocation คำนวณใหม่จากต้นฉบับ immutable; ห้ามแบ่งต่อจาก allocation ก่อนหน้า
- Recipient payload ห้ามมีต้นฉบับเต็มหรือ allocation ของคนอื่น แม้ UI จะซ่อนไว้
- Share หมดอายุเมื่อ `now >= expiresAt`; join หรือ reconnect ไม่ต่ออายุ
- ข้อความว่างจากการหารเป็นผลลัพธ์ปกติและต้องแสดงข้อความตรงตัวว่า `คุณได้รับข้อมูล 0 ตัวอักษร`
- เป้าหมาย deployment คือ Node process เดียวพร้อม persistent volume; multi-instance อยู่พ้น MVP
- **อัปเดต 2026-10-10:** ผู้ใช้เลือก hosting เป็น Vercel ซึ่งขัดกับข้อด้านบน ต้องเลือกแนวทาง storage/realtime ก่อน Task 4 (ดู `docs/decisions.md`) และต้องเพิ่ม End share (Creator ปิด share ก่อนหมดอายุ)
- ใช้ `PUBLIC_ORIGIN` สร้าง URL/QR และตรวจ HTTP/WebSocket origin; ห้ามเชื่อ Host header ที่ผู้ใช้ส่งมา
- Runtime baseline คือ Node 22 ที่ตรวจว่า `DatabaseSync` ใช้งานได้แล้ว โมดูล `node:sqlite` ยังมีสถานะ experimental ใน Node 22 จึงต้อง pin Node 22 ใน runtime และมี repository tests ครอบ persistence
- Package versions ต้อง resolve ให้รองรับ Node 22 และบันทึกใน `package-lock.json` ตอนลงมือทำ ห้ามเดาเลขเวอร์ชันในแผน
- Input/resource limits ค่าเริ่มต้น: JSON body 256 KiB, text 20,000 grapheme clusters, image upload 5 MiB, decoded image 12 megapixels, normalized longest edge 1024 px, cumulative Recipients สูงสุด 64 คนต่อ share (ขนาดผู้ชมที่ยืนยัน 2026-10-10) และ concurrent collage renders 4 งานต่อ process ทุกค่า override ได้ด้วย environment variables
- จำกัดชนิดภาพเป็น PNG, JPEG และ static WebP; reject animated/malformed/spoofed files จาก decoded metadata ไม่ใช้แค่ extension หรือ MIME ที่ client แจ้ง
- ไม่ commit/push อัตโนมัติ แต่ละ task จบด้วย checkpoint ที่ตรวจ diff และผล test; commit เมื่อผู้ใช้สั่งเท่านั้น
- ห้ามอ้างว่า mobile/public deployment ผ่านจนกว่าจะทดสอบกับ HTTPS URL และอุปกรณ์หรือ browser context ที่แยกจริง

## Review Focus

| Failure class | Required owning test |
| --- | --- |
| identity race ทำให้ browser เดียวถูกนับสองครั้ง | Task 2 integration test `reuses the server session cookie idempotently` และ Task 6 Playwright test `two fresh tabs share one recipient identity` ซึ่งทดสอบ Web Lock จริง |
| Unicode/empty text ถูกแบ่งผิด | Task 1 tests `partitions Thai graphemes and emoji without splitting clusters` และ `returns normal empty allocations when recipients exceed units` |
| update/collage เก่าทับ revision ใหม่ | Task 4 test `rejects stale collage after revision changes` และ Task 5 reducer test `ignores snapshots and image responses older than current revision` |
| expiration/restart ทำให้ share ฟื้นหรือหายผิดเวลา | Task 4 tests `expires exactly at expiresAt without extension` และ Task 6 test `restores active share and rejects expired share after restart` |
| recipient ได้ pixel ที่ไม่ใช่ของตนหรือได้ original เต็ม | Task 3 tests `allocates every source pixel exactly once per revision` และ Task 6 response audit `never exposes original image bytes or another recipient allocation` |

---

## File and Responsibility Map

```text
package.json                         Scripts and locked dependency entrypoint
package-lock.json                    Reproducible Node dependency graph
tsconfig.json                        Shared/client/test TypeScript configuration
tsconfig.server.json                 Node server production build configuration
vite.config.ts                       Client build and local API/WebSocket proxy
vitest.config.ts                     Unit and integration test configuration
playwright.config.ts                 Multi-context browser test configuration
.env.example                         Documented non-secret runtime settings
.gitignore                           Excludes data, builds, coverage, local env
index.html                           Vite HTML entrypoint

src/shared/contracts.ts              HTTP/WebSocket DTOs and error codes
src/core/partition.ts                Grapheme-aware exact text allocation
src/core/collage.ts                  Deterministic pixel allocation and packing plan
src/server/config.ts                 Validated environment configuration
src/server/db.ts                     SQLite schema, migrations and transactions
src/server/identity.ts               Opaque browser session cookie lifecycle
src/server/share-service.ts          Share creation, idempotent join and snapshots
src/server/image-service.ts          Decode, normalize, store and render image data
src/server/realtime.ts               Authenticated WebSocket rooms and broadcasts
src/server/expiry.ts                 Expiration scheduling and source cleanup
src/server/app.ts                    Express routes, validation and error mapping
src/server/index.ts                  Process startup, shutdown and static serving

src/web/main.tsx                     React bootstrap
src/web/App.tsx                      Route selection for `/` and `/s/:shareId`
src/web/CreatePage.tsx               Text/image form and creator result screen
src/web/SharePage.tsx                Recipient allocation, counts and states
src/web/api.ts                       Session/create/join/snapshot/image HTTP client
src/web/share-state.ts               Revision-aware client state reducer
src/web/useShareChannel.ts           WebSocket lifecycle and reconnect policy
src/web/styles.css                   Responsive interface styles

tests/unit/partition.test.ts         Text rules and Unicode invariants
tests/unit/collage.test.ts           Pixel ownership and deterministic layout
tests/unit/share-state.test.ts       Client revision/terminal-state rules
tests/integration/test-server.ts     Disposable DB/data dir/server harness
tests/integration/shares.test.ts     Identity, join, persistence and text API
tests/integration/images.test.ts     Validation, rendering and data isolation
tests/integration/realtime.test.ts   Broadcast, reconnect and expiration behavior
tests/e2e/share.spec.ts              Creator/recipient browser demo flows
tests/load/demo-load.ts              Bounded 1→64 join smoke test

Dockerfile                           Pinned Node 22 single-instance image
.dockerignore                        Minimal Docker build context
docs/setup.md                        Local and production-like runbook
docs/demo.md                         Demo script and failure recovery steps
```

ไม่มีไฟล์แยกสำหรับ repository/domain/API layer เพิ่มอีกใน MVP จนกว่าความซับซ้อนจริงจะพิสูจน์ว่าจำเป็น

## Domain and Transport Contracts

ให้สร้างชื่อและ shape ต่อไปนี้ก่อนเริ่ม server/UI เพื่อไม่ให้แต่ละชั้นนิยาม contract ซ้ำกัน:

```ts
type ContentType = "text" | "image";
type ShareStatus = "active" | "expired";

type TextAllocation = {
  kind: "text";
  text: string;
  unitCount: number;
  totalUnits: number;
};

type ImageAllocation = {
  kind: "image";
  imageUrl: string | null;
  pixelCount: number;
  totalPixels: number;
  width: number;
  height: number;
  fragmentCount: number;
};

type RecipientSnapshot = {
  shareId: string;
  revision: number;
  status: ShareStatus;
  recipientNumber: number;
  recipientCount: number;
  expiresAt: string;
  allocation: TextAllocation | ImageAllocation;
};

type ServerEvent =
  | { type: "snapshot"; snapshot: RecipientSnapshot }
  | { type: "expired"; shareId: string; expiresAt: string }
  | { type: "error"; code: ApiErrorCode; message: string };

type CreateShareResponse = {
  shareUrl: string;
  qrDataUrl: string | null;
  qrStatus: "ready" | "unavailable";
  snapshot: RecipientSnapshot;
};
```

HTTP surface:

| Method/path | Input | Success | Expected failures |
| --- | --- | --- | --- |
| `POST /api/session` | session cookie if present | `204`, sets/refreshes HttpOnly cookie | `403 ORIGIN_NOT_ALLOWED` |
| `POST /api/shares/text` | `{ text: string }` | `201 { shareUrl, qrDataUrl, qrStatus, snapshot }`; QR may be null only when generation cannot encode the validated URL | `400 INVALID_TEXT`, `413 TEXT_TOO_LARGE` |
| `POST /api/shares/image` | multipart field `image` | `201 { shareUrl, qrDataUrl, qrStatus, snapshot }`; same QR fallback contract | `400`, `413`, `415 INVALID_IMAGE` |
| `POST /api/shares/:shareId/join` | cookie | `200 RecipientSnapshot` | `404 SHARE_NOT_FOUND`, `410 SHARE_EXPIRED`, `429 RECIPIENT_LIMIT` |
| `GET /api/shares/:shareId/snapshot` | member cookie | `200 RecipientSnapshot` | `401`, `403 NOT_A_RECIPIENT`, `404`, `410` |
| `GET /api/shares/:shareId/collage?revision=N` | member cookie | `200 image/png` | `401`, `403`, `404`, `409 STALE_REVISION`, `410`, `503 RENDER_BUSY` |
| `GET /api/health` | none | `200 { status: "ok" }` | `503` only when startup dependency failed |
| `WS /ws?shareId=…` | member cookie + allowed Origin | initial latest snapshot, then events | close with documented application code for unauthorized/expired |

`shareId`, visitor IDs and session tokens use cryptographically random UUID/token values generated by server. URL contains only `shareId`; recipient identity stays in the HttpOnly cookie. Store only a SHA-256 token hash in SQLite.

### Task 1: Scaffold the App and Lock Text Partitioning

**Files:**

- Create: `package.json`, `package-lock.json`
- Create: `tsconfig.json`, `tsconfig.server.json`, `vite.config.ts`, `vitest.config.ts`
- Create: `.env.example`, `.gitignore`, `index.html`
- Create: `src/shared/contracts.ts`
- Create: `src/core/partition.ts`
- Test: `tests/unit/partition.test.ts`

**Interfaces:**

- Consumes: exact text behavior from `Project.md`; no application code.
- Produces: shared DTOs plus the pure text functions below for Task 2 onward.

```ts
export type TextSlice = { start: number; length: number; text: string };
export function segmentText(text: string): string[];
export function partitionText(
  text: string,
  recipientCount: number,
): TextSlice[];
```

- [ ] Initialize npm metadata and install only the dependencies named in Tech Stack, plus `typescript`, `tsx`, `concurrently` and type packages required by compilation. Require Node `>=22 <23`; commit the generated lockfile only if the user later requests a commit.
- [ ] Add scripts `dev`, `test`, `test:e2e`, `typecheck`, `build`, `start` and `load:demo`. At this task, `test`, `typecheck` and the core TypeScript build path must already be runnable; later tasks fill the app targets.
- [ ] Write failing `partitionText` tests with exact assertions:
  - `partitions canonical ABCDEFGH examples`: N=1 → `ABCDEFGH`, N=2 → `ABCD|EFGH`, N=3 → `ABC|DEF|GH`, N=4 → `AB|CD|EF|GH`.
  - `partitions Thai graphemes and emoji without splitting clusters`: use `Intl.Segmenter("th", { granularity: "grapheme" })` as the expected unit boundary, including a combining-mark Thai sample and an emoji ZWJ sequence.
  - `preserves spaces and newlines`: concatenating all slices equals the exact source bytes represented as the original JS string.
  - `returns normal empty allocations when recipients exceed units`: `ABCDEFGH`, N=9 gives `A`…`H`, `""`; all nine slices exist.
  - `rejects invalid recipient counts`: zero, negative and non-integer values throw a typed programmer error.

```ts
it("partitions canonical ABCDEFGH examples", () => {
  expect(partitionText("ABCDEFGH", 2).map((part) => part.text)).toEqual(["ABCD", "EFGH"]);
  expect(partitionText("ABCDEFGH", 4).map((part) => part.text)).toEqual(["AB", "CD", "EF", "GH"]);
});

it("returns normal empty allocations when recipients exceed units", () => {
  expect(partitionText("ABCDEFGH", 9).map((part) => part.text)).toEqual([
    "A", "B", "C", "D", "E", "F", "G", "H", "",
  ]);
});

it("partitions Thai graphemes and emoji without splitting clusters", () => {
  const family = "👨‍👩‍👧‍👦";
  expect(segmentText(`ก้${family}ข`)).toEqual(["ก้", family, "ข"]);
  expect(partitionText(`ก้${family}ข`, 3).map((part) => part.text)).toEqual(["ก้", family, "ข"]);
});
```
- [ ] Run `npm test -- tests/unit/partition.test.ts`; expected result is failure because `segmentText`/`partitionText` do not exist.
- [ ] Implement `segmentText` with `Intl.Segmenter(undefined, { granularity: "grapheme" })`. Implement the specified `q/r`, `start`, `length` algorithm over grapheme arrays; do not trim, normalize or mutate text.
- [ ] Add shared DTO types from Domain and Transport Contracts plus a closed `ApiErrorCode` union. Keep types serialization-safe and free of framework imports.
- [ ] Run `npm test -- tests/unit/partition.test.ts` and `npm run typecheck`; expected result is all assertions passing with no type errors.
- [ ] Checkpoint: inspect dependency list, lockfile and diff; verify no server, UI or unused abstraction was introduced.

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
- [ ] Treat QR generation as optional presentation output after a successful share commit: if encoding fails, return `201` with the usable `shareUrl`/`snapshot`, `qrDataUrl: null` and `qrStatus: "unavailable"`; never turn a committed share into an unrecoverable 500. Apply this contract to text and image creation.
- [ ] Run `npm test -- tests/integration/shares.test.ts` and `npm run typecheck`; expected result is passing identity, transaction, persistence and HTTP assertions.
- [ ] Checkpoint: inspect DB file after a test run and confirm raw session token, QR, original image data and recipient allocations are not persisted in the wrong tables.

### Task 3: Allocate and Render Deterministic Image Collages

**Files:**

- Create: `src/core/collage.ts`
- Create: `src/server/image-service.ts`
- Create: `tests/unit/collage.test.ts`
- Create: `tests/integration/images.test.ts`
- Modify: `src/server/share-service.ts`
- Modify: `src/server/app.ts`
- Modify: `src/server/config.ts`
- Modify: `src/shared/contracts.ts`

**Interfaces:**

- Consumes: `ShareService`, `RecipientSnapshot`, SQLite image metadata fields and test server from Task 2.
- Produces: deterministic collage plan, stored image lifecycle and `ShareService.createImage()` for later HTTP/realtime/UI tasks.

```ts
export type SourceRect = { x: number; y: number; width: number; height: number };
export type PlacedFragment = SourceRect & { destX: number; destY: number };
export type CollagePlan = {
  canvasWidth: number;
  canvasHeight: number;
  pixelCount: number;
  fragments: PlacedFragment[];
};

export function createTileStream(
  width: number,
  height: number,
  shareId: string,
  gridSize?: number,
): readonly SourceRect[];
export function allocateCollage(
  tiles: readonly SourceRect[],
  recipientCount: number,
  recipientNumber: number,
): CollagePlan;

export type StoredImage = {
  path: string;
  width: number;
  height: number;
  totalPixels: number;
};

export class ImageService {
  normalizeAndStore(input: Buffer, shareId: string): Promise<StoredImage>;
  renderCollage(image: StoredImage, plan: CollagePlan): Promise<Buffer>;
  deleteSource(image: StoredImage): Promise<void>;
}

export interface ShareService {
  createImage(visitorId: VisitorId, original: StoredImage): RecipientSnapshot;
}
```

Algorithm fixed for MVP:

1. Normalize EXIF orientation; decode PNG/JPEG/static WebP; resize only when longest edge exceeds 1024 px; store canonical RGBA bytes under `DATA_DIR/originals/<shareId>.rgba` with width/height in SQLite.
2. Divide source coordinates into a 32×32 boundary grid, omitting zero-area cells. Sort tiles deterministically by SHA-256 of `<shareId>:<tileIndex>`, then tile index as tie-breaker.
3. Treat the shuffled tile pixels, each tile in row-major order, as one virtual stream. Give each Recipient an exact contiguous `q/r` range of that virtual stream. Split a partial tile range into first row, whole middle rows and last row rectangles.
4. Pack owned rectangles with a deterministic shelf layout, no rotate/scale. Shelf width is `max(widestFragment, ceil(sqrt(pixelCount)))`; transparent padding is display layout, not owned source data.
5. For N=1, return one full-source rectangle at its original coordinates so dividing by one shows the complete unchanged image. If pixel count is lower than Recipient count, later Recipients receive `imageUrl=null`, zero canvas dimensions and zero fragments.

- [ ] Write failing pure tests:
  - `allocates every source pixel exactly once per revision`: reconstruct coordinate ownership for sizes including 1×1, 7×5 and 64×48 at N=1,2,3,4,256; assert no duplicate/missing coordinates.
  - `keeps allocations within one pixel of fair share`: each `pixelCount` equals the same q/r formula as text.
  - `is deterministic for the same share and revision inputs` and differs for at least two distinct share IDs on a nontrivial image.
  - `preserves the full original layout for one recipient` and `produces multiple scattered fragments where source dimensions allow it` for a representative image and N=2..8.
  - `returns a valid zero allocation when recipients exceed pixels`.
  - `packs without overlap or out-of-bounds destinations`.

```ts
it("allocates every source pixel exactly once per revision", () => {
  for (const recipientCount of [1, 2, 3, 4]) {
    const plans = recipientNumbers(recipientCount).map((recipientNumber) =>
      allocateCollage(createTileStream(7, 5, "share-a"), recipientCount, recipientNumber),
    );
    expect(expandOwnedCoordinates(plans).sort()).toEqual(allCoordinates(7, 5).sort());
    expect(findDuplicateCoordinates(plans)).toEqual([]);
  }
});
```
- [ ] Run `npm test -- tests/unit/collage.test.ts`; expected result is failure because collage functions do not exist.
- [ ] Implement the pure coordinate algorithm exactly as specified. Avoid allocating one object per pixel: intersection math must operate on tile/row rectangles while tests may expand coordinates only for small fixtures.
- [ ] Run the collage unit test; expected result is passing property/invariant assertions.
- [ ] Write failing image integration tests:
  - `normalizes EXIF orientation and renders only owned unique-color pixels` using a generated tiny fixture where every source coordinate has a unique color.
  - `rejects spoofed MIME, corrupt input, animated image, oversized bytes and decoded pixel bomb` before a share becomes visible.
  - `removes an orphan source when database creation fails`.
  - `returns no-store PNG only to its recipient and current revision`.
  - `never exposes original image route, file path, metadata or bytes` by enumerating create/snapshot/collage responses and public static paths.

```ts
it("rejects spoofed and corrupt image input", async () => {
  const spoofed = await uploadImage(server, pngHeadersWithNonImageBody());
  expect(spoofed.status).toBe(415);
  expect(await spoofed.json()).toMatchObject({ code: "INVALID_IMAGE" });
  expect(countRows(server.db, "shares")).toBe(0);
});
```
- [ ] Run `npm test -- tests/integration/images.test.ts`; expected result is failure because image service/routes are absent.
- [ ] Implement upload with Multer memory storage and byte/file-count limits. Configure Sharp's decoded-pixel limit to 12 megapixels and inspect decoded metadata before allocation. For animated WebP (`pages > 1`) return `415 INVALID_IMAGE`.
- [ ] Store canonical raw RGBA under a server-only data directory outside the public web root. Persist only a generated relative filename, resolve it under the configured originals directory with a containment check, write to a temporary sibling file then atomically rename; if DB creation fails, remove only that resolved explicit file.
- [ ] Implement collage rendering by copying each owned source row into a transparent RGBA destination buffer, then encode that destination as PNG through Sharp. Never pass original file bytes to an HTTP response.
- [ ] Implement authenticated `GET /collage?revision=N` derived from cookie membership; client cannot choose recipient number. Add `Cache-Control: private, no-store` and a four-slot render semaphore; excess work returns `503 RENDER_BUSY` with retry guidance.
- [ ] Validate revision and expiration immediately before rendering and again after async rendering. If changed, discard output and return `409 STALE_REVISION` with current revision metadata; if expired return `410`.
- [ ] Run image unit/integration tests and `npm run typecheck`; expected result is passing validation, exact ownership and isolation assertions.
- [ ] Checkpoint: search built client assets and HTTP fixtures for source path/original bytes; verify image files live only under test data directory and are cleaned by the harness.

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

### Task 6: Verify the Complete Multi-Browser Demo and Persistence

**Files:**

- Create: `playwright.config.ts`
- Create: `tests/e2e/share.spec.ts`
- Create: `tests/load/demo-load.ts`
- Modify: `tests/integration/test-server.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: test server from Task 2, completed HTTP/WebSocket/UI behavior from Tasks 3–5 and the stable UI hooks from Task 5.
- Produces: reusable multi-context helpers, restart harness and bounded load report for final acceptance.

```ts
export function createSeparateContexts(browser: Browser, count: number): Promise<BrowserContext[]>;
export function createTextFromUI(context: BrowserContext, text: string): Promise<string>;
export function joinFromUI(context: BrowserContext, shareUrl: string): Promise<Page>;
export function expectAllocations(
  contexts: BrowserContext[],
  expectedText: string[],
  recipientCount: number,
): Promise<void>;
export function runDemoLoad(options: {
  origin: string;
  maxRecipients: number;
  concurrency: number;
}): Promise<{ elapsedMs: number; peakRssBytes: number }>;
```

**Test harness rules:**

- Each simulated person uses a separate Playwright browser context; tabs for the same person share one context.
- Start server on an ephemeral port with a temporary persistent data directory.
- Tests may restart the process while preserving that directory.
- Use a fake/controllable server clock hook only in test mode; production API must not expose clock controls.

- [ ] Write failing E2E `text repartitions live from one to four recipients`: Creator creates `ABCDEFGH`; three new contexts join; after each join every open page shows the exact current allocation and recipient count without manual reload.
- [ ] Write failing E2E `two fresh tabs share one recipient identity`: in one brand-new context, navigate two pages to the same share concurrently before either has a session; assert count grows once and both tabs show the same recipient number.
- [ ] Write failing E2E `ninth recipient sees exact zero-character message`: preserve N=9 and assert the exact Thai copy with live status.
- [ ] Write failing E2E `image collages replace in real time`: upload a coordinate-color image, join through N=4, assert each page receives a new image URL/revision, no page fetches another recipient URL, and visible pixel-count labels decrease according to q/r.
- [ ] Write failing E2E `late image response cannot overwrite latest revision`: delay one collage response, join a new recipient, release delayed response and assert the page remains on newest revision.
- [ ] Write failing E2E `connection loss recovers latest state without new recipient`: disconnect one context, add two recipients, reconnect and assert it jumps to latest allocation with unchanged identity.
- [ ] Write integration/E2E `restores active share and rejects expired share after restart`: restart with same DB/data directory, verify active state, advance to exact expiry, restart again and assert 410/expired UI with no source served.
- [ ] Add response audit `never exposes original image bytes or another recipient allocation`: record all browser HTTP/WS responses for a Recipient and compare against unique fixture pixels and original file signature.

```ts
test("text repartitions live from one to four recipients", async ({ browser }) => {
  const people = await createSeparateContexts(browser, 4);
  const shareUrl = await createTextFromUI(people[0], "ABCDEFGH");
  await joinFromUI(people[1], shareUrl);
  await expectAllocations(people.slice(0, 2), ["ABCD", "EFGH"], 2);
  await joinFromUI(people[2], shareUrl);
  await joinFromUI(people[3], shareUrl);
  await expectAllocations(people, ["AB", "CD", "EF", "GH"], 4);
});

test("ninth recipient sees exact zero-character message", async ({ browser }) => {
  const ninth = await joinThroughRecipient(browser, 9, "ABCDEFGH");
  await expect(ninth.getByText("คุณได้รับข้อมูล 0 ตัวอักษร", { exact: true })).toBeVisible();
  await expect(ninth.getByTestId("recipient-count")).toHaveText("9");
});
```
- [ ] Run `npm run test:e2e -- tests/e2e/share.spec.ts` and `npm test -- tests/integration/shares.test.ts`; expected result is FAIL in the restart/clock/multi-context harness paths that do not exist yet, while earlier product tests remain passing.
- [ ] Add only the harness hooks needed for repeatable startup, clock and restart; keep them unavailable unless `NODE_ENV=test` and an in-process test dependency supplies them.
- [ ] Implement `tests/load/demo-load.ts`: create one text and one representative image share, join 64 unique cookie jars with bounded concurrency, assert final `recipientCount=64`, monotonic revisions and acceptable responses; attempt #65 and assert `429 RECIPIENT_LIMIT`. Report elapsed time and peak process memory without imposing an unmeasured pass threshold.
- [ ] Run `npm run test:e2e`, `npm run load:demo`, `npm test`, `npm run typecheck` and `npm run build`; expected result is all correctness checks passing and load script completing without crashes/unhandled rejections.
- [ ] Manually run the browser flow at desktop and mobile viewport widths, including copy URL and QR rendering. Record findings in `docs/demo.md`; do not claim a physical phone/public network test yet.
- [ ] Checkpoint: preserve Playwright traces/screenshots only for failures; inspect final data directory and process logs for secrets, original payloads and unexpected unhandled errors.

### Task 7: Package the Single-Instance Demo and Document Operations

**Files:**

- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docs/setup.md`
- Create: `docs/demo.md`
- Modify: `src/server/index.ts`
- Modify: `src/server/app.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `Project.md`
- Test: `tests/integration/shares.test.ts`

**Interfaces:**

- Consumes: build scripts and restart harness from Task 6 plus the complete app.
- Produces: compiled single-process server, container artifact and operator documentation.

```ts
export type BuiltServer = {
  origin: string;
  close(): Promise<void>;
};
export function runBuiltServer(options: {
  dataDir: string;
  publicOrigin?: string;
}): Promise<BuiltServer>;
```

- [ ] Write a failing production smoke test in `tests/integration/shares.test.ts` that builds the client/server, starts compiled output with a temporary `DATA_DIR`, loads `/`, loads `/s/<id>` via SPA fallback, calls `/api/health`, creates a share and reconnects after restart.

```ts
it("serves the compiled SPA and preserves a share across restart", async () => {
  const first = await runBuiltServer({ dataDir });
  expect((await fetch(`${first.origin}/api/health`)).status).toBe(200);
  const { shareId, cookie } = await createCompiledTextShare(first.origin, "ABCDEFGH");
  await first.close();
  const second = await runBuiltServer({ dataDir });
  expect((await fetch(`${second.origin}/s/${shareId}`)).headers.get("content-type")).toContain("text/html");
  expect((await getSnapshot(second.origin, cookie, shareId)).recipientCount).toBe(1);
  await second.close();
});
```
- [ ] Run the targeted production smoke test; expected result is failure until compiled static serving/start paths are wired.
- [ ] Configure production Express to serve `dist/client`, preserve `/api` and `/ws`, and return `index.html` only for browser routes. Build server to a documented `dist/server` entrypoint compatible with package scripts.
- [ ] Create a multi-stage `Dockerfile` pinned to Node 22, running as a non-root user, exposing the configured port and declaring `/app/data` as the persistence location. Add an HTTP healthcheck against `/api/health` if the image contains an available probe tool; otherwise document platform health path instead of installing a large tool only for healthcheck.
- [ ] Ensure graceful shutdown waits for HTTP close, WebSocket close and DB close. Startup must fail loudly if `DATA_DIR` is not writable or `PUBLIC_ORIGIN` is invalid.
- [ ] Document exact local commands, environment variables, persistent-volume requirement, HTTPS/reverse-proxy WebSocket requirement, Node 22 `node:sqlite` experimental status, single-instance limit, 24-hour cleanup and backup expectations in `docs/setup.md`.
- [ ] Write `docs/demo.md` as a short rehearsal: create text, scan QR, add Recipients 2→4, demonstrate live shrinking, open same browser tab without recount, show image collage, explain expiry and provide restart steps if network fails.
- [ ] Update `Project.md` current state, actual commands, final file structure, verified limits and remaining public/mobile verification. Keep user-confirmed product decisions distinct from technical choices made during implementation.
- [ ] Run the production smoke test, all automated checks and a container build. Start the container with an explicit test volume, create a share, restart the same container/image with the same volume and verify the share persists. Expected result is PASS for the smoke test and all checks, a successful image build, and the restarted container returning the original share at the same revision/count.
- [ ] If the user provides or authorizes a hosting target, deploy one instance with persistent storage and HTTPS, set `PUBLIC_ORIGIN`, then verify QR from a separate phone/network and WebSocket updates through N=4. If no target is provided, stop after the verified local/container artifact and report public/mobile deployment as unresolved rather than inventing infrastructure or cost.
- [ ] Final checkpoint: inspect `git diff --check`, dependency audit output, build/test results and documentation accuracy. Do not commit, push or deploy unless separately authorized.

## Final Acceptance Run

Execute in this order after all tasks:

```powershell
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run load:demo
docker build -t share-division:local .
```

Then verify these observable outcomes:

- `ABCDEFGH` matches N=2 and N=4 canonical allocations on separate browser contexts.
- Creator remains Recipient #1; closing pages never reduces count.
- Same browser refresh and multiple tabs retain one recipient number.
- All open pages replace allocations after a new join without refresh.
- N=9 shows `คุณได้รับข้อมูล 0 ตัวอักษร` to the empty Recipient.
- Image pages show deterministic scattered collages whose owned pixels partition the source exactly.
- Old revisions, delayed image responses and reconnect gaps cannot roll the UI backward.
- Active data persists across process/container restart; exact 24-hour boundary returns expired and deletes image source.
- Network responses to one Recipient never include the original image or another Recipient's allocation.
- Public URL/QR/mobile claims are made only if the conditional deployment verification was actually performed.

## Implementation References

- [Node.js SQLite API](https://nodejs.org/api/sqlite.html)
- [Sharp input and raw pixel APIs](https://sharp.pixelplumbing.com/api-input/)
- [`ws` WebSocket library](https://github.com/websockets/ws)
- [Multer multipart middleware](https://expressjs.com/en/resources/middleware/multer.html)
- [`qrcode` package](https://github.com/soldair/node-qrcode)
- [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
- [Vite guide](https://vite.dev/guide/)
