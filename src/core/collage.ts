export type SourceRect = { x: number; y: number; width: number; height: number };
export type PlacedFragment = SourceRect & { destX: number; destY: number };
export type CollagePlan = { canvasWidth: number; canvasHeight: number; pixelCount: number; fragments: PlacedFragment[] };

export type GridLayout = { rows: number; columnsPerRow: number[] };

/**
 * Splits N recipients into rows of near-square cells for a width×height image.
 * Rows may hold different cell counts (the first N % rows rows get one extra), so the cells
 * always tile the whole image exactly: no unowned leftover cell when N is not a perfect grid.
 */
export function gridLayout(width: number, height: number, recipientCount: number): GridLayout {
  if (![width, height, recipientCount].every((value) => Number.isSafeInteger(value) && value > 0)) throw new RangeError("Image dimensions and recipient count must be positive integers");
  const rows = Math.min(recipientCount, Math.max(1, Math.round(Math.sqrt(recipientCount * height / width))));
  const base = Math.floor(recipientCount / rows);
  const extra = recipientCount % rows;
  return { rows, columnsPerRow: Array.from({ length: rows }, (_, row) => base + (row < extra ? 1 : 0)) };
}

/**
 * One solid block per recipient: recipient #1 is the top-left cell, numbered in reading order.
 * Cells come from integer boundaries of the full image, so every source pixel belongs to exactly
 * one recipient. A cell can be empty when there are more recipients than pixels in that direction.
 */
export function allocateGridCell(width: number, height: number, recipientCount: number, recipientNumber: number): CollagePlan {
  if (!Number.isSafeInteger(recipientNumber) || recipientNumber < 1 || recipientNumber > recipientCount) throw new RangeError("Invalid recipient");
  const { rows, columnsPerRow } = gridLayout(width, height, recipientCount);
  let index = recipientNumber - 1;
  let row = 0;
  while (index >= columnsPerRow[row]!) index -= columnsPerRow[row++]!;
  const columns = columnsPerRow[row]!;
  // Rounding boundaries up gives leftover pixels to earlier recipients, like the text split.
  const y = Math.ceil(row * height / rows);
  const cellHeight = Math.ceil((row + 1) * height / rows) - y;
  const x = Math.ceil(index * width / columns);
  const cellWidth = Math.ceil((index + 1) * width / columns) - x;
  const pixelCount = cellWidth * cellHeight;
  if (pixelCount === 0) return { canvasWidth: 0, canvasHeight: 0, pixelCount: 0, fragments: [] };
  return { canvasWidth: cellWidth, canvasHeight: cellHeight, pixelCount, fragments: [{ x, y, width: cellWidth, height: cellHeight, destX: 0, destY: 0 }] };
}
