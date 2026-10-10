import { expect, it } from "vitest";
import { allocateGridCell, gridLayout, type CollagePlan } from "../../src/core/collage.js";

function sourcePixels(plans: CollagePlan[]): string[] {
  return plans.flatMap((plan) => plan.fragments.flatMap((fragment) => {
    const pixels: string[] = [];
    for (let y = fragment.y; y < fragment.y + fragment.height; y++) for (let x = fragment.x; x < fragment.x + fragment.width; x++) pixels.push(`${x},${y}`);
    return pixels;
  }));
}

it("allocates every source pixel exactly once across all grid cells", () => {
  for (const [width, height] of [[1, 1], [7, 5], [64, 48], [48, 64], [1024, 576]]) {
    const total = width! * height!;
    for (const count of [1, 2, 3, 4, 5, 7, 9, 64]) {
      const plans = Array.from({ length: count }, (_, i) => allocateGridCell(width!, height!, count, i + 1));
      const pixels = sourcePixels(plans);
      expect(pixels.length).toBe(total);
      expect(new Set(pixels).size).toBe(total);
      expect(plans.reduce((sum, plan) => sum + plan.pixelCount, 0)).toBe(total);
    }
  }
});

it("gives each recipient one solid block drawn at the canvas origin", () => {
  for (const count of [2, 3, 4, 6, 64]) {
    for (let number = 1; number <= count; number++) {
      const plan = allocateGridCell(640, 480, count, number);
      expect(plan.fragments).toHaveLength(1);
      expect(plan.fragments[0]).toMatchObject({ destX: 0, destY: 0, width: plan.canvasWidth, height: plan.canvasHeight });
      expect(plan.pixelCount).toBe(plan.canvasWidth * plan.canvasHeight);
    }
  }
});

it("lays four recipients on a square image out as a 2x2 grid in reading order", () => {
  const cells = [1, 2, 3, 4].map((number) => allocateGridCell(100, 100, 4, number).fragments[0]);
  expect(cells).toEqual([
    { x: 0, y: 0, width: 50, height: 50, destX: 0, destY: 0 },
    { x: 50, y: 0, width: 50, height: 50, destX: 0, destY: 0 },
    { x: 0, y: 50, width: 50, height: 50, destX: 0, destY: 0 },
    { x: 50, y: 50, width: 50, height: 50, destX: 0, destY: 0 },
  ]);
});

it("keeps cells near square for wide, tall and uneven recipient counts", () => {
  expect(gridLayout(100, 100, 3)).toEqual({ rows: 2, columnsPerRow: [2, 1] });
  expect(gridLayout(100, 100, 9)).toEqual({ rows: 3, columnsPerRow: [3, 3, 3] });
  expect(gridLayout(1600, 400, 4)).toEqual({ rows: 1, columnsPerRow: [4] });
  expect(gridLayout(400, 1600, 4)).toEqual({ rows: 4, columnsPerRow: [1, 1, 1, 1] });
  expect(gridLayout(1024, 1024, 64)).toEqual({ rows: 8, columnsPerRow: Array(8).fill(8) });
});

it("preserves the whole image for one recipient and is deterministic", () => {
  expect(allocateGridCell(64, 48, 1, 1)).toEqual({ canvasWidth: 64, canvasHeight: 48, pixelCount: 3072, fragments: [{ x: 0, y: 0, width: 64, height: 48, destX: 0, destY: 0 }] });
  expect(allocateGridCell(64, 48, 7, 5)).toEqual(allocateGridCell(64, 48, 7, 5));
});

it("returns an empty allocation when the image has fewer pixels than recipients", () => {
  // Like the text split, earlier recipients keep the leftover pixels.
  expect(allocateGridCell(1, 1, 2, 1).pixelCount).toBe(1);
  expect(allocateGridCell(1, 1, 2, 2)).toEqual({ canvasWidth: 0, canvasHeight: 0, pixelCount: 0, fragments: [] });
  expect(() => allocateGridCell(10, 10, 3, 4)).toThrow(RangeError);
});
