import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;

/** A real H.264 + AAC MP4 test pattern with a keyframe every second (6 GOPs for 6 s). */
export function makeMp4(directory: string, seconds = 6): Buffer {
  const output = join(directory, `clip-${seconds}s.mp4`);
  execFileSync(ffmpeg, [
    "-v", "error", "-y",
    "-f", "lavfi", "-i", "testsrc=size=160x120:rate=25", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
    "-t", String(seconds), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-g", "25", "-keyint_min", "25", "-sc_threshold", "0",
    "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", output,
  ]);
  return readFileSync(output);
}
