/**
 * Minimal ISO-BMFF (MP4) reader: finds the video track and the times of its keyframes.
 * Keyframes are where a video can be cut without re-encoding, so the spans between them
 * (GOPs) are the units a video share is divided into.
 */
/** `keyframeSamples[i]` is the sample (frame) number where GOP i starts; `sampleCount` is the track's total frames. */
export type Mp4Index = { durationMs: number; keyframesMs: number[]; keyframeSamples: number[]; sampleCount: number; codec: string; width: number; height: number };

export class Mp4FormatError extends Error {}

type Box = { type: string; start: number; end: number; body: number };

function* boxes(view: DataView, start: number, end: number): Generator<Box> {
  let offset = start;
  while (offset + 8 <= end) {
    let size = view.getUint32(offset);
    const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) throw new Mp4FormatError("Truncated box header");
      size = Number(view.getBigUint64(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) throw new Mp4FormatError(`Invalid ${type} box size`);
    yield { type, start: offset, end: offset + size, body: offset + header };
    offset += size;
  }
}

const child = (view: DataView, parent: Box, type: string) => {
  for (const box of boxes(view, parent.body, parent.end)) if (box.type === type) return box;
  return undefined;
};

const path = (view: DataView, parent: Box | undefined, ...types: string[]) =>
  types.reduce<Box | undefined>((box, type) => box && child(view, box, type), parent);

function readFullBoxVersion(view: DataView, box: Box) { return view.getUint8(box.body); }

export function parseMp4(data: Uint8Array): Mp4Index {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let ftyp = false;
  let moov: Box | undefined;
  for (const box of boxes(view, 0, data.byteLength)) {
    if (box.type === "ftyp") ftyp = true;
    if (box.type === "moov") moov = box;
  }
  if (!ftyp || !moov) throw new Mp4FormatError("Not an MP4 file");

  for (const trak of boxes(view, moov.body, moov.end)) {
    if (trak.type !== "trak") continue;
    const mdia = child(view, trak, "mdia");
    const hdlr = path(view, mdia, "hdlr");
    if (!mdia || !hdlr || String.fromCharCode(...data.subarray(hdlr.body + 8, hdlr.body + 12)) !== "vide") continue;

    const mdhd = child(view, mdia, "mdhd")!;
    const v1 = readFullBoxVersion(view, mdhd) === 1;
    const timescale = view.getUint32(mdhd.body + (v1 ? 20 : 12));
    const trackDuration = v1 ? Number(view.getBigUint64(mdhd.body + 24)) : view.getUint32(mdhd.body + 16);
    const stbl = path(view, mdia, "minf", "stbl");
    const stts = path(view, stbl, "stts");
    const stsd = path(view, stbl, "stsd");
    if (!stbl || !stts || !stsd || !timescale) throw new Mp4FormatError("Video track has no sample table");

    // Decode time of every sample from stts (sample count, delta) runs.
    const sampleTimes: number[] = [];
    let time = 0;
    const runs = view.getUint32(stts.body + 4);
    for (let i = 0; i < runs; i++) {
      const count = view.getUint32(stts.body + 8 + i * 8);
      const delta = view.getUint32(stts.body + 12 + i * 8);
      for (let n = 0; n < count; n++) { sampleTimes.push(time); time += delta; }
    }
    if (sampleTimes.length === 0) throw new Mp4FormatError("Fragmented or empty MP4 is not supported");

    // stss lists 1-based keyframe sample numbers; without it every sample is a keyframe.
    const stss = path(view, stbl, "stss");
    let keyframes: number[];
    if (stss) {
      const count = view.getUint32(stss.body + 4);
      keyframes = Array.from({ length: count }, (_, i) => view.getUint32(stss.body + 8 + i * 4) - 1).filter((n) => n < sampleTimes.length);
    } else {
      keyframes = sampleTimes.map((_, i) => i);
    }
    if (keyframes[0] !== 0) keyframes.unshift(0);
    keyframes = [...new Set(keyframes)].sort((a, b) => a - b);

    const entry = [...boxes(view, stsd.body + 8, stsd.end)][0];
    const codec = entry?.type ?? "unknown";
    // Visual sample entries store width/height at fixed offsets after the 8-byte box header.
    const width = entry ? view.getUint16(entry.body + 24) : 0;
    const height = entry ? view.getUint16(entry.body + 26) : 0;
    const durationTicks = Math.max(trackDuration, time);
    return {
      durationMs: Math.round((durationTicks * 1000) / timescale),
      keyframesMs: keyframes.map((n) => Math.round((sampleTimes[n]! * 1000) / timescale)),
      keyframeSamples: keyframes,
      sampleCount: sampleTimes.length,
      codec,
      width,
      height,
    };
  }
  throw new Mp4FormatError("MP4 has no video track");
}

export type GopIndex = Pick<Mp4Index, "durationMs" | "keyframesMs" | "keyframeSamples" | "sampleCount">;

/** Time range [startMs, endMs) and exact frame count covered by GOPs [start, start + count). */
export function gopRange(index: GopIndex, start: number, count: number): { startMs: number; endMs: number; frames: number } {
  const last = start + count >= index.keyframesMs.length;
  const startMs = index.keyframesMs[start] ?? index.durationMs;
  const endMs = last ? index.durationMs : index.keyframesMs[start + count]!;
  const frames = (last ? index.sampleCount : index.keyframeSamples[start + count]!) - (index.keyframeSamples[start] ?? index.sampleCount);
  return { startMs, endMs, frames };
}
