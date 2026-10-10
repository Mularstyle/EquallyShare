import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";

/**
 * Private storage for originals and derived media. Keys are always server-generated:
 * `<uuid>.png` (image), `<uuid>.mp3` (audio), `<uuid>.mp4` (video), `<uuid>.pdf` (PDF), `uploads/<uuid>.mp4|pdf` (pending
 * direct upload) and `segments/<uuid>/<name>.mp4|pdf` (cached per-recipient video cuts and PDF page ranges).
 */
export interface ImageStore {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  move(from: string, to: string): Promise<void>;
  /** Keys directly under a `prefix/` folder, with creation time in ms when known. */
  list(prefix: string): Promise<{ key: string; createdAt: number | undefined }[]>;
  /** A URL the browser can PUT the file to directly, or undefined when the API must receive it. */
  createUploadUrl(key: string): Promise<string | undefined>;
  /** A short-lived URL the browser can read directly, or undefined when the API must stream it. */
  createDownloadUrl(key: string, expiresInSeconds: number): Promise<string | undefined>;
}

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const keyPattern = new RegExp(`^(?:${uuid}\\.(?:png|mp3|mp4|pdf)|uploads/${uuid}\\.(?:mp4|pdf)|segments/${uuid}/[a-z0-9-]{1,40}\\.(?:mp4|pdf))$`, "i");
const prefixPattern = new RegExp(`^(?:uploads|segments/${uuid})$`, "i");

export function assertImageKey(key: string): void {
  if (!keyPattern.test(key)) throw new Error("Invalid storage key");
}

function assertPrefix(prefix: string): void {
  if (!prefixPattern.test(prefix)) throw new Error("Invalid storage prefix");
}

const contentType = (key: string) => key.endsWith(".mp3") ? "audio/mpeg" : key.endsWith(".mp4") ? "video/mp4" : key.endsWith(".pdf") ? "application/pdf" : "image/png";

export class FileImageStore implements ImageStore {
  private readonly directory: string;

  constructor(dataDir: string) { this.directory = resolve(dataDir, "originals"); }

  /** Absolute path of a key on local disk (local development and tests only). */
  path(key: string): string {
    assertImageKey(key);
    const full = resolve(this.directory, key);
    if (!full.startsWith(this.directory + sep)) throw new Error("Invalid image path");
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    const temporary = join(dirname(target), `.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, data, { flag: "wx", mode: 0o600 });
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  async get(key: string): Promise<Buffer> { return readFile(this.path(key)); }

  async delete(key: string): Promise<void> { await rm(this.path(key), { force: true }); }

  async exists(key: string): Promise<boolean> { return stat(this.path(key)).then(() => true, () => false); }

  async move(from: string, to: string): Promise<void> {
    const target = this.path(to);
    await mkdir(dirname(target), { recursive: true });
    await rename(this.path(from), target);
  }

  async list(prefix: string): Promise<{ key: string; createdAt: number | undefined }[]> {
    assertPrefix(prefix);
    const folder = resolve(this.directory, prefix);
    const names = await readdir(folder).catch(() => [] as string[]);
    const entries = await Promise.all(names.filter((name) => !name.startsWith(".")).map(async (name) => ({ key: `${prefix}/${name}`, createdAt: (await stat(join(folder, name))).mtimeMs })));
    return entries.filter((entry) => keyPattern.test(entry.key));
  }

  async createUploadUrl(): Promise<undefined> { return undefined; }

  async createDownloadUrl(): Promise<undefined> { return undefined; }

  /** Removes an empty `segments/<uuid>` folder left after its files are deleted. */
  async removeFolder(prefix: string): Promise<void> {
    assertPrefix(prefix);
    await rm(resolve(this.directory, prefix), { recursive: true, force: true });
  }
}

/** Private Supabase Storage bucket, reached only with the server-side service-role key. */
export class SupabaseImageStore implements ImageStore {
  private readonly bucket;

  constructor(url: string, serviceRoleKey: string, bucketName: string) {
    this.bucket = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(bucketName);
  }

  async put(key: string, data: Buffer): Promise<void> {
    assertImageKey(key);
    const { error } = await this.bucket.upload(key, data, { contentType: contentType(key), upsert: false });
    if (error) throw new Error(`Upload failed: ${error.message}`);
  }

  async get(key: string): Promise<Buffer> {
    assertImageKey(key);
    const { data, error } = await this.bucket.download(key);
    if (error || !data) throw new Error(`Download failed: ${error?.message ?? "empty"}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    assertImageKey(key);
    const { error } = await this.bucket.remove([key]);
    if (error) throw new Error(`Delete failed: ${error.message}`);
  }

  async exists(key: string): Promise<boolean> {
    assertImageKey(key);
    const { data, error } = await this.bucket.exists(key);
    if (error) return false;
    return data;
  }

  async move(from: string, to: string): Promise<void> {
    assertImageKey(from);
    assertImageKey(to);
    const { error } = await this.bucket.move(from, to);
    if (error) throw new Error(`Move failed: ${error.message}`);
  }

  async list(prefix: string): Promise<{ key: string; createdAt: number | undefined }[]> {
    assertPrefix(prefix);
    const { data, error } = await this.bucket.list(prefix, { limit: 1000 });
    if (error) throw new Error(`List failed: ${error.message}`);
    return (data ?? [])
      .map((item) => ({ key: `${prefix}/${item.name}`, createdAt: item.created_at ? Date.parse(item.created_at) : undefined }))
      .filter((entry) => keyPattern.test(entry.key));
  }

  async createUploadUrl(key: string): Promise<string> {
    assertImageKey(key);
    const { data, error } = await this.bucket.createSignedUploadUrl(key);
    if (error || !data) throw new Error(`Signed upload failed: ${error?.message ?? "empty"}`);
    return data.signedUrl;
  }

  async createDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    assertImageKey(key);
    const { data, error } = await this.bucket.createSignedUrl(key, expiresInSeconds);
    if (error || !data) throw new Error(`Signed download failed: ${error?.message ?? "empty"}`);
    return data.signedUrl;
  }
}
