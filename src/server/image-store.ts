import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";

/** Private storage for normalized source images. Keys are server-generated `<uuid>.png` names. */
export interface ImageStore {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const keyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/i;

export function assertImageKey(key: string): void {
  if (!keyPattern.test(key) || basename(key) !== key) throw new Error("Invalid image key");
}

export class FileImageStore implements ImageStore {
  private readonly directory: string;

  constructor(dataDir: string) { this.directory = resolve(dataDir, "originals"); }

  private path(key: string): string {
    assertImageKey(key);
    const full = resolve(this.directory, key);
    if (!full.startsWith(this.directory + sep)) throw new Error("Invalid image path");
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.path(key);
    const temporary = join(this.directory, `.${key}.${randomUUID()}.tmp`);
    await mkdir(this.directory, { recursive: true });
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
}

/** Private Supabase Storage bucket, reached only with the server-side service-role key. */
export class SupabaseImageStore implements ImageStore {
  private readonly bucket;

  constructor(url: string, serviceRoleKey: string, bucketName: string) {
    this.bucket = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(bucketName);
  }

  async put(key: string, data: Buffer): Promise<void> {
    assertImageKey(key);
    const { error } = await this.bucket.upload(key, data, { contentType: "image/png", upsert: false });
    if (error) throw new Error(`Image upload failed: ${error.message}`);
  }

  async get(key: string): Promise<Buffer> {
    assertImageKey(key);
    const { data, error } = await this.bucket.download(key);
    if (error || !data) throw new Error(`Image download failed: ${error?.message ?? "empty"}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    assertImageKey(key);
    const { error } = await this.bucket.remove([key]);
    if (error) throw new Error(`Image delete failed: ${error.message}`);
  }
}
