export type TextSlice = { start: number; length: number; text: string };
export type UnitRange = { start: number; length: number };

/**
 * The shared division rule: `total` units split into contiguous ranges in join order;
 * everyone gets floor(total / count) and the first total % count recipients get one more.
 */
export function partitionRange(total: number, recipientCount: number, recipientNumber: number): UnitRange {
  if (!Number.isInteger(total) || total < 0 || !Number.isInteger(recipientCount) || recipientCount <= 0 || !Number.isInteger(recipientNumber) || recipientNumber < 1 || recipientNumber > recipientCount) {
    throw new RangeError("Invalid partition request");
  }
  const base = Math.floor(total / recipientCount);
  const remainder = total % recipientCount;
  const index = recipientNumber - 1;
  return { start: index * base + Math.min(index, remainder), length: base + (index < remainder ? 1 : 0) };
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function segmentText(text: string): string[] {
  return Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment);
}

export function partitionText(text: string, recipientCount: number): TextSlice[] {
  if (!Number.isInteger(recipientCount) || recipientCount <= 0) {
    throw new RangeError("recipientCount must be a positive integer");
  }

  const graphemes = segmentText(text);
  const baseLength = Math.floor(graphemes.length / recipientCount);
  const remainder = graphemes.length % recipientCount;
  let start = 0;

  return Array.from({ length: recipientCount }, (_, recipientIndex) => {
    const length = baseLength + (recipientIndex < remainder ? 1 : 0);
    const slice: TextSlice = {
      start,
      length,
      text: graphemes.slice(start, start + length).join(""),
    };
    start += length;
    return slice;
  });
}
