import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import sharp from "sharp";
import type { CollagePlan } from "../core/collage.js";
import { ShareError } from "./share-service.js";

export type StoredImage = { path: string; width: number; height: number; totalPixels: number };

export class ImageService {
  private readonly originalsDir: string;

  constructor(dataDir: string, private readonly maxPixels = 12_000_000, private readonly maxEdge = 1024) {
    this.originalsDir = resolve(dataDir, "originals");
  }

  private sourcePath(image: StoredImage): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.rgba$/i.test(image.path) || basename(image.path) !== image.path) throw new Error("Invalid image filename");
    const full = resolve(this.originalsDir, image.path);
    if (!full.startsWith(this.originalsDir + sep)) throw new Error("Invalid image path");
    return full;
  }

  async normalizeAndStore(input: Buffer, shareId: string): Promise<StoredImage> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shareId)) throw new Error("Invalid share ID");
    let data: Buffer;
    let width: number;
    let height: number;
    try {
      const decoder = sharp(input, { limitInputPixels: this.maxPixels, animated: false, failOn: "error" });
      const metadata = await decoder.metadata();
      if (!["png", "jpeg", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1 || !metadata.width || !metadata.height || metadata.width * metadata.height > this.maxPixels) throw new Error("Unsupported image");
      const result = await decoder.rotate().resize({ width: this.maxEdge, height: this.maxEdge, fit: "inside", withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      data = result.data;
      width = result.info.width;
      height = result.info.height;
      if (width * height > this.maxPixels || result.info.channels !== 4 || data.length !== width * height * 4) throw new Error("Invalid decoded image");
    } catch {
      throw new ShareError("INVALID_IMAGE", 415, "Invalid or unsupported image");
    }
    const image: StoredImage = { path: `${shareId}.rgba`, width, height, totalPixels: width * height };
    const target = this.sourcePath(image);
    const temporary = join(this.originalsDir, `.${shareId}.${randomUUID()}.tmp`);
    await mkdir(this.originalsDir, { recursive: true });
    try {
      await writeFile(temporary, data, { flag: "wx", mode: 0o600 });
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
    return image;
  }

  async renderCollage(image: StoredImage, plan: CollagePlan): Promise<Buffer> {
    if (plan.pixelCount === 0 || plan.canvasWidth === 0 || plan.canvasHeight === 0) throw new Error("Cannot render empty collage");
    const source = await readFile(this.sourcePath(image));
    if (source.length !== image.width * image.height * 4) throw new Error("Corrupt stored image");
    const output = Buffer.alloc(plan.canvasWidth * plan.canvasHeight * 4);
    for (const fragment of plan.fragments) {
      for (let row = 0; row < fragment.height; row++) {
        const sourceOffset = ((fragment.y + row) * image.width + fragment.x) * 4;
        const destinationOffset = ((fragment.destY + row) * plan.canvasWidth + fragment.destX) * 4;
        source.copy(output, destinationOffset, sourceOffset, sourceOffset + fragment.width * 4);
      }
    }
    return sharp(output, { raw: { width: plan.canvasWidth, height: plan.canvasHeight, channels: 4 } }).png().toBuffer();
  }

  async deleteSource(image: StoredImage): Promise<void> { await rm(this.sourcePath(image), { force: true }); }
}
