import { expect, it } from "vitest";
import { allocateCollage, createTileStream, type CollagePlan } from "../../src/core/collage.js";

function sourcePixels(plans: CollagePlan[]): string[] {
  return plans.flatMap((plan) => plan.fragments.flatMap((fragment) => {
    const pixels: string[] = [];
    for (let y = fragment.y; y < fragment.y + fragment.height; y++) for (let x = fragment.x; x < fragment.x + fragment.width; x++) pixels.push(`${x},${y}`);
    return pixels;
  }));
}

it("allocates every source pixel exactly once with fair q/r shares", () => {
  for (const [width, height] of [[1, 1], [7, 5], [64, 48]]) {
    const total = width! * height!;
    for (const count of [1, 2, 3, 4, 256]) {
      const tiles = createTileStream(width!, height!, "share-a");
      const plans = Array.from({ length: count }, (_, i) => allocateCollage(tiles, count, i + 1));
      const pixels = sourcePixels(plans);
      expect(pixels.length).toBe(total);
      expect(new Set(pixels).size).toBe(total);
      for (let y = 0; y < height!; y++) for (let x = 0; x < width!; x++) expect(pixels).toContain(`${x},${y}`);
      plans.forEach((plan, i) => expect(plan.pixelCount).toBe(Math.floor(total / count) + (i < total % count ? 1 : 0)));
    }
  }
});

it("is deterministic and share-specific", () => {
  const a = createTileStream(64, 48, "share-a");
  expect(a).toEqual(createTileStream(64, 48, "share-a"));
  expect(a).not.toEqual(createTileStream(64, 48, "share-b"));
  expect(allocateCollage(a, 3, 2)).toEqual(allocateCollage(a, 3, 2));
});

it("preserves the entire layout for one recipient and scatters later allocations", () => {
  const tiles = createTileStream(64, 48, "share-a");
  expect(allocateCollage(tiles, 1, 1)).toEqual({ canvasWidth: 64, canvasHeight: 48, pixelCount: 3072, fragments: [{ x: 0, y: 0, width: 64, height: 48, destX: 0, destY: 0 }] });
  for (let count = 2; count <= 8; count++) expect(allocateCollage(tiles, count, 1).fragments.length).toBeGreaterThan(1);
  const empty = allocateCollage(createTileStream(1, 1, "a"), 256, 256);
  expect(empty).toEqual({ canvasWidth: 0, canvasHeight: 0, pixelCount: 0, fragments: [] });
});

it("packs destinations without overlap or out of bounds", () => {
  for (const count of [2, 3, 8, 256]) {
    for (let number = 1; number <= count; number++) {
      const plan = allocateCollage(createTileStream(64, 48, "share-a"), count, number);
      const occupied = new Set<string>();
      for (const fragment of plan.fragments) {
        expect(fragment.destX + fragment.width).toBeLessThanOrEqual(plan.canvasWidth);
        expect(fragment.destY + fragment.height).toBeLessThanOrEqual(plan.canvasHeight);
        for (let y = fragment.destY; y < fragment.destY + fragment.height; y++) for (let x = fragment.destX; x < fragment.destX + fragment.width; x++) {
          const key = `${x},${y}`;
          expect(occupied.has(key)).toBe(false);
          occupied.add(key);
        }
      }
      expect(occupied.size).toBe(plan.pixelCount);
    }
  }
});
