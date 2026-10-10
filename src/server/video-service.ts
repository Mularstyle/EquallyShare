import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { gopRange, Mp4FormatError, parseMp4, type GopIndex, type Mp4Index } from "../core/mp4.js";
import { ShareError } from "./share-service.js";

const run = promisify(execFile);

/**
 * Path of the ffmpeg binary installed by `ffmpeg-static`, resolved lazily on the first cut.
 * The package is not imported: on Vercel only the binary itself is shipped (vercel.json includeFiles),
 * and nothing here may throw while the module loads, or every API route would fail.
 */
let ffmpegPath: string | undefined;

/** For the health check: whether video cutting can run on this instance. Never throws. */
export function ffmpegAvailable(): boolean {
  try { ffmpeg(); return true; } catch { return false; }
}
function ffmpeg(): string {
  if (ffmpegPath) return ffmpegPath;
  const name = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const candidates = [process.env.FFMPEG_PATH, join(process.cwd(), "node_modules", "ffmpeg-static", name)].filter((path): path is string => Boolean(path));
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error(`ffmpeg binary not found (looked in ${candidates.join(", ")})`);
  return (ffmpegPath = found);
}
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
    const input = await this.localOriginal(originalKey, load);
    const { startMs, endMs, frames } = gopRange(index, start, count);
    const output = join(workDir, `${randomUUID()}.mp4`);
    try {
      await run(ffmpeg(), [
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
