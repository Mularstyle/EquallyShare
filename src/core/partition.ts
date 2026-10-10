export type TextSlice = { start: number; length: number; text: string };

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
