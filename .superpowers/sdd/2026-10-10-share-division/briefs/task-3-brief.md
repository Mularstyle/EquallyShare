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

