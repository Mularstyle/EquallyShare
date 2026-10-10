import { expect, it } from "vitest";
import { frameDurationMs, Mp3FormatError, parseMp3, sliceFrames } from "../../src/core/mp3.js";
import { partitionRange } from "../../src/core/partition.js";
import { frameBytes, frameIndexes, mp3File } from "../fixtures/mp3.js";

it("parses consecutive Layer III frames and their timing", () => {
  const stream = parseMp3(mp3File(10));
  expect(stream.frames).toHaveLength(10);
  expect(stream.frames[3]).toEqual({ offset: 3 * frameBytes, length: frameBytes });
  expect([stream.sampleRate, stream.samplesPerFrame]).toEqual([44100, 1152]);
  expect(frameDurationMs(stream)).toBeCloseTo(26.12, 2);
});

it("skips ID3v2, the Xing info frame and a trailing ID3v1 tag", () => {
  const data = mp3File(5, { id3: true, xing: true, id3v1: true });
  const stream = parseMp3(data);
  expect(stream.frames).toHaveLength(5);
  expect(frameIndexes(sliceFrames(data, stream.frames, 0, 5))).toEqual([0, 1, 2, 3, 4]);
});

it("rejects files that are not MP3 audio", () => {
  for (const data of [Buffer.from("not an mp3 at all"), Buffer.alloc(5000), Buffer.concat([mp3File(1), Buffer.alloc(5000, 7)])]) {
    expect(() => parseMp3(data)).toThrow(Mp3FormatError);
  }
});

it("cuts contiguous segments in join order that rebuild the original exactly", () => {
  const data = mp3File(10);
  const { frames } = parseMp3(data);
  for (const count of [1, 2, 3, 4, 10, 12]) {
    const pieces = Array.from({ length: count }, (_, i) => {
      const { start, length } = partitionRange(frames.length, count, i + 1);
      return frameIndexes(sliceFrames(data, frames, start, length));
    });
    expect(pieces.flat()).toEqual([...Array(10).keys()]);
    if (count === 3) expect(pieces).toEqual([[0, 1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    if (count === 12) expect(pieces.slice(10)).toEqual([[], []]);
  }
});
