import { createHash } from "node:crypto";

export type SourceRect = { x: number; y: number; width: number; height: number };
export type PlacedFragment = SourceRect & { destX: number; destY: number };
export type CollagePlan = { canvasWidth: number; canvasHeight: number; pixelCount: number; fragments: PlacedFragment[] };

export function createTileStream(width: number, height: number, shareId: string, gridSize = 32): readonly SourceRect[] {
  if (![width, height, gridSize].every((value) => Number.isSafeInteger(value) && value > 0)) throw new RangeError("Image and grid dimensions must be positive integers");
  const tiles: { rect: SourceRect; index: number; hash: Buffer }[] = [];
  for (let row = 0; row < gridSize; row++) {
    const y = Math.floor(row * height / gridSize);
    const bottom = Math.floor((row + 1) * height / gridSize);
    for (let column = 0; column < gridSize; column++) {
      const x = Math.floor(column * width / gridSize);
      const right = Math.floor((column + 1) * width / gridSize);
      if (right > x && bottom > y) {
        const index = row * gridSize + column;
        tiles.push({ rect: { x, y, width: right - x, height: bottom - y }, index, hash: createHash("sha256").update(`${shareId}:${index}`).digest() });
      }
    }
  }
  tiles.sort((a, b) => Buffer.compare(a.hash, b.hash) || a.index - b.index);
  return tiles.map(({ rect }) => rect);
}

export function allocateCollage(tiles: readonly SourceRect[], recipientCount: number, recipientNumber: number): CollagePlan {
  if (!Number.isSafeInteger(recipientCount) || recipientCount < 1 || !Number.isSafeInteger(recipientNumber) || recipientNumber < 1 || recipientNumber > recipientCount) throw new RangeError("Invalid recipient");
  const total = tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0);
  const base = Math.floor(total / recipientCount);
  const remainder = total % recipientCount;
  const start = (recipientNumber - 1) * base + Math.min(recipientNumber - 1, remainder);
  const pixelCount = base + (recipientNumber <= remainder ? 1 : 0);
  if (pixelCount === 0) return { canvasWidth: 0, canvasHeight: 0, pixelCount, fragments: [] };
  if (recipientCount === 1) {
    const canvasWidth = Math.max(...tiles.map((tile) => tile.x + tile.width));
    const canvasHeight = Math.max(...tiles.map((tile) => tile.y + tile.height));
    return { canvasWidth, canvasHeight, pixelCount, fragments: [{ x: 0, y: 0, width: canvasWidth, height: canvasHeight, destX: 0, destY: 0 }] };
  }
  const owned: SourceRect[] = [];
  const end = start + pixelCount;
  let offset = 0;
  for (const tile of tiles) {
    const tileEnd = offset + tile.width * tile.height;
    const localStart = Math.max(0, start - offset);
    const localEnd = Math.min(tileEnd - offset, end - offset);
    if (localEnd > localStart) {
      let position = localStart;
      while (position < localEnd) {
        const row = Math.floor(position / tile.width);
        const column = position % tile.width;
        const length = Math.min(localEnd - position, tile.width - column);
        const last = owned.at(-1);
        if (column === 0 && length === tile.width && last && last.x === tile.x && last.width === tile.width && last.y + last.height === tile.y + row) last.height++;
        else owned.push({ x: tile.x + column, y: tile.y + row, width: length, height: 1 });
        position += length;
      }
    }
    offset = tileEnd;
    if (offset >= end) break;
  }
  const shelfWidth = Math.max(Math.max(...owned.map((rect) => rect.width)), Math.ceil(Math.sqrt(pixelCount)));
  const fragments: PlacedFragment[] = [];
  let destX = 0;
  let destY = 0;
  let shelfHeight = 0;
  let usedWidth = 0;
  for (const rect of owned) {
    if (destX + rect.width > shelfWidth) { destY += shelfHeight; destX = 0; shelfHeight = 0; }
    fragments.push({ ...rect, destX, destY });
    destX += rect.width;
    shelfHeight = Math.max(shelfHeight, rect.height);
    usedWidth = Math.max(usedWidth, destX);
  }
  return { canvasWidth: usedWidth, canvasHeight: destY + shelfHeight, pixelCount, fragments };
}
