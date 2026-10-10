/**
 * Minimal MPEG audio Layer III frame parser. MP3 is a sequence of short self-describing frames
 * (~26 ms each), so audio can be divided at frame boundaries without decoding.
 */
export type Mp3Frame = { offset: number; length: number };
export type Mp3Stream = { frames: Mp3Frame[]; sampleRate: number; samplesPerFrame: number };

type FrameHeader = { length: number; sampleRate: number; samplesPerFrame: number; version: number; mono: boolean };

const bitratesV1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const bitratesV2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const sampleRates: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

function readHeader(data: Uint8Array, offset: number): FrameHeader | undefined {
  if (offset + 4 > data.length || data[offset] !== 0xff || (data[offset + 1]! & 0xe0) !== 0xe0) return undefined;
  const b1 = data[offset + 1]!;
  const b2 = data[offset + 2]!;
  const version = (b1 >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5, 1 = reserved
  const layer = (b1 >> 1) & 3; // 1 = Layer III
  const bitrateIndex = b2 >> 4;
  const rateIndex = (b2 >> 2) & 3;
  if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return undefined;
  const mpeg1 = version === 3;
  const bitrate = (mpeg1 ? bitratesV1 : bitratesV2)[bitrateIndex]! * 1000;
  const sampleRate = sampleRates[version]![rateIndex]!;
  const padding = (b2 >> 1) & 1;
  const length = Math.floor(((mpeg1 ? 144 : 72) * bitrate) / sampleRate) + padding;
  return { length, sampleRate, samplesPerFrame: mpeg1 ? 1152 : 576, version, mono: (data[offset + 3]! >> 6) === 3 };
}

function id3v2Size(data: Uint8Array): number {
  if (data.length < 10 || data[0] !== 0x49 || data[1] !== 0x44 || data[2] !== 0x33) return 0; // "ID3"
  const size = ((data[6]! & 0x7f) << 21) | ((data[7]! & 0x7f) << 14) | ((data[8]! & 0x7f) << 7) | (data[9]! & 0x7f);
  const footer = (data[5]! & 0x10) ? 10 : 0;
  return 10 + size + footer;
}

const ascii = (data: Uint8Array, offset: number, length: number) => String.fromCharCode(...data.subarray(offset, offset + length));

/** A Xing/Info/VBRI frame carries encoder metadata, not sound, and would report the wrong length for a segment. */
function isMetadataFrame(data: Uint8Array, offset: number, header: FrameHeader): boolean {
  const sideInfo = header.version === 3 ? (header.mono ? 17 : 32) : (header.mono ? 9 : 17);
  const tag = ascii(data, offset + 4 + sideInfo, 4);
  return tag === "Xing" || tag === "Info" || ascii(data, offset + 36, 4) === "VBRI";
}

export class Mp3FormatError extends Error {}

/**
 * Returns the audio frames of an MP3, skipping ID3v2 tags, the Xing/Info frame and anything after
 * the last consistent frame (ID3v1/APE tags, truncation). Rejects files that are mostly not MP3 frames.
 */
export function parseMp3(data: Uint8Array): Mp3Stream {
  let offset = id3v2Size(data);
  // Some encoders pad before the first frame: resync on a header followed by another valid header.
  const searchEnd = Math.min(data.length, offset + 4096);
  while (offset < searchEnd) {
    const header = readHeader(data, offset);
    if (header && (offset + header.length >= data.length || readHeader(data, offset + header.length))) break;
    offset++;
  }
  const first = readHeader(data, offset);
  if (!first) throw new Mp3FormatError("No MP3 audio frames found");
  const audioStart = offset;

  const frames: Mp3Frame[] = [];
  while (offset < data.length) {
    const header = readHeader(data, offset);
    if (!header || header.version !== first.version || header.sampleRate !== first.sampleRate || offset + header.length > data.length) break;
    if (!(frames.length === 0 && offset === audioStart && isMetadataFrame(data, offset, header))) frames.push({ offset, length: header.length });
    offset += header.length;
  }
  const covered = frames.reduce((sum, frame) => sum + frame.length, 0);
  if (frames.length === 0 || covered < (data.length - audioStart) * 0.5) throw new Mp3FormatError("File is not a consistent MP3 stream");
  return { frames, sampleRate: first.sampleRate, samplesPerFrame: first.samplesPerFrame };
}

/** Concatenates frames [start, start + count) into a standalone MP3 byte stream. */
export function sliceFrames(data: Uint8Array, frames: readonly Mp3Frame[], start: number, count: number): Uint8Array {
  const chosen = frames.slice(start, start + count);
  const output = new Uint8Array(chosen.reduce((sum, frame) => sum + frame.length, 0));
  let position = 0;
  for (const frame of chosen) {
    output.set(data.subarray(frame.offset, frame.offset + frame.length), position);
    position += frame.length;
  }
  return output;
}

export const frameDurationMs = (stream: Pick<Mp3Stream, "sampleRate" | "samplesPerFrame">) => (stream.samplesPerFrame * 1000) / stream.sampleRate;
