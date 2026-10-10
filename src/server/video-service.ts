import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { gopRange, Mp4FormatError, parseMp4, type GopIndex, type Mp4Index } from "../core/mp4.js";
import { ShareError } from "./share-service.js";

const run = promisify(execFile);
// CommonJS package exporting the platform binary path (null on unsupported platforms).
const ffmpegPath = createRequire(import.meta.url)("ffmpeg-static") as string | null;
const workDir = join(tmpdir(), "equallyshare-video");
const cacheLimit = 3;

/** Reads keyframes from uploaded MP4s and cuts per-recipient GOP ranges with ffmpeg stream copy (no re-encoding). */
export class VideoService {
  // Originals copied to local temp disk, so repeated cuts on a warm instance skip the download.
  private readonly localOriginals = new Map<string, string>();

  inspect(data: Uint8Array): Mp4Index {
    try {
      const index = parseMp4(data);
      if (index.durationMs <= 0 || index.keyframesMs.length === 0) throw new Mp4FormatError("Empty video");
      return index;
    } catch (error) {
      if (error instanceof Mp4FormatError || error instanceof RangeError) throw new ShareError("INVALID_VIDEO", 415, "Invalid or unsupported MP4");
      throw error;
    }
  }

  /** Cuts GOPs [start, start + count) from the original into a standalone MP4 with timestamps starting at zero. */
  async cut(originalKey: string, load: () => Promise<Buffer>, index: GopIndex, start: number, count: number): Promise<Buffer> {
    if (!ffmpegPath) throw new Error("ffmpeg binary is not available on this platform");
    const input = await this.localOriginal(originalKey, load);
    const { startMs, endMs, frames } = gopRange(index, start, count);
    const output = join(workDir, `${randomUUID()}.mp4`);
    try {
      await run(ffmpegPath, [
        "-v", "error", "-y",
        "-ss", (startMs / 1000).toFixed(3), "-i", input, "-t", ((endMs - startMs) / 1000).toFixed(3),
        // Exact frame count: with B-frames, the next range's keyframe decodes before the end time and would slip in.
        "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy", "-frames:v", String(frames),
        "-avoid_negative_ts", "make_zero", "-movflags", "+faststart", "-f", "mp4", output,
      ], { timeout: 50_000, maxBuffer: 1024 * 1024 });
      return await readFile(output);
    } finally {
      await rm(output, { force: true });
    }
  }

  async forget(originalKey: string): Promise<void> {
    const path = this.localOriginals.get(originalKey);
    this.localOriginals.delete(originalKey);
    if (path) await rm(path, { force: true });
  }

  private async localOriginal(key: string, load: () => Promise<Buffer>): Promise<string> {
    const cached = this.localOriginals.get(key);
    if (cached && await stat(cached).then(() => true, () => false)) return cached;
    await mkdir(workDir, { recursive: true });
    const path = join(workDir, `original-${randomUUID()}.mp4`);
    await writeFile(path, await load());
    this.localOriginals.set(key, path);
    while (this.localOriginals.size > cacheLimit) {
      const [oldKey, oldPath] = this.localOriginals.entries().next().value!;
      this.localOriginals.delete(oldKey);
      await rm(oldPath, { force: true });
    }
    return path;
  }
}
