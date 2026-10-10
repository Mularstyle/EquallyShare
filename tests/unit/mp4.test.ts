import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { gopRange, Mp4FormatError, parseMp4 } from "../../src/core/mp4.js";
import { makeMp4 } from "../fixtures/mp4.js";

let directory: string;
let clip: Buffer;
beforeAll(() => { directory = mkdtempSync(join(tmpdir(), "equallyshare-mp4-unit-")); clip = makeMp4(directory); });
afterAll(() => rmSync(directory, { recursive: true, force: true }));

it("reads duration, codec, size and one keyframe per second", () => {
  const index = parseMp4(new Uint8Array(clip));
  expect(index).toMatchObject({ durationMs: 6000, codec: "avc1", width: 160, height: 120, sampleCount: 150 });
  expect(index.keyframesMs).toEqual([0, 1000, 2000, 3000, 4000, 5000]);
  expect(index.keyframeSamples).toEqual([0, 25, 50, 75, 100, 125]);
});

it("maps GOP ranges to exact times and frame counts", () => {
  const index = parseMp4(new Uint8Array(clip));
  expect(gopRange(index, 0, 2)).toEqual({ startMs: 0, endMs: 2000, frames: 50 });
  expect(gopRange(index, 5, 1)).toEqual({ startMs: 5000, endMs: 6000, frames: 25 });
});

it("rejects files that are not MP4 or have no video track", () => {
  expect(() => parseMp4(new TextEncoder().encode("plain text, not a container"))).toThrow(Mp4FormatError);
  const ffmpeg = join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  const audioOnly = join(directory, "audio-only.mp4");
  execFileSync(ffmpeg, ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440", "-t", "1", "-c:a", "aac", audioOnly]);
  expect(() => parseMp4(new Uint8Array(readFileSync(audioOnly)))).toThrow(/no video track/);
});
