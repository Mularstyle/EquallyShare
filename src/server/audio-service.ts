import { Mp3FormatError, parseMp3, sliceFrames, type Mp3Frame } from "../core/mp3.js";
import type { ImageStore } from "./image-store.js";
import { ShareError } from "./share-service.js";

export type StoredAudio = { path: string; frameCount: number; sampleRate: number; samplesPerFrame: number };

const cacheLimit = 6;

/** Validates MP3 uploads, stores only their audio frames, and cuts per-recipient segments at frame boundaries. */
export class AudioService {
  private readonly parsed = new Map<string, { data: Uint8Array; frames: Mp3Frame[] }>();

  constructor(private readonly store: ImageStore) {}

  async normalizeAndStore(input: Buffer, shareId: string): Promise<StoredAudio> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shareId)) throw new Error("Invalid share ID");
    let stream;
    try { stream = parseMp3(input); }
    catch (error) {
      if (error instanceof Mp3FormatError) throw new ShareError("INVALID_AUDIO", 415, "Invalid or unsupported MP3");
      throw error;
    }
    // Tags and the VBR info frame are dropped so the stored original is exactly its audio frames.
    const audio = sliceFrames(input, stream.frames, 0, stream.frames.length);
    const stored: StoredAudio = { path: `${shareId}.mp3`, frameCount: stream.frames.length, sampleRate: stream.sampleRate, samplesPerFrame: stream.samplesPerFrame };
    await this.store.put(stored.path, Buffer.from(audio));
    return stored;
  }

  /** Returns frames [start, start + count) of the stored original as a standalone MP3. */
  async renderSegment(path: string, start: number, count: number): Promise<Buffer> {
    const { data, frames } = await this.load(path);
    if (start < 0 || count <= 0 || start + count > frames.length) throw new Error("Segment outside stored audio");
    return Buffer.from(sliceFrames(data, frames, start, count));
  }

  async deleteSource(path: string): Promise<void> {
    this.parsed.delete(path);
    await this.store.delete(path);
  }

  private async load(path: string) {
    const cached = this.parsed.get(path);
    if (cached) return cached;
    const data = new Uint8Array(await this.store.get(path));
    const entry = { data, frames: parseMp3(data).frames };
    this.parsed.set(path, entry);
    while (this.parsed.size > cacheLimit) this.parsed.delete(this.parsed.keys().next().value!);
    return entry;
  }
}
