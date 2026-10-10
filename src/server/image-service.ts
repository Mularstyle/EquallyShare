import sharp from "sharp";
import type { CollagePlan } from "../core/collage.js";
import type { ImageStore } from "./image-store.js";
import { ShareError } from "./share-service.js";

export type StoredImage = { path: string; width: number; height: number; totalPixels: number };

// Decoded originals are reused across renders on a warm instance so each collage request
// does not re-download the source from storage (free-plan egress is limited).
const cacheLimit = 6;

export class ImageService {
  private readonly decoded = new Map<string, Buffer>();

  constructor(private readonly store: ImageStore, private readonly maxPixels = 12_000_000, private readonly maxEdge = 1024) {}

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
    const image: StoredImage = { path: `${shareId}.png`, width, height, totalPixels: width * height };
    // Lossless PNG keeps exact source pixels while storing far fewer bytes than raw RGBA.
    await this.store.put(image.path, await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer());
    this.remember(image.path, data);
    return image;
  }

  async renderCollage(image: StoredImage, plan: CollagePlan): Promise<Buffer> {
    if (plan.pixelCount === 0 || plan.canvasWidth === 0 || plan.canvasHeight === 0) throw new Error("Cannot render empty collage");
    const source = await this.source(image);
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

  async deleteSource(image: StoredImage): Promise<void> {
    this.decoded.delete(image.path);
    await this.store.delete(image.path);
  }

  private async source(image: StoredImage): Promise<Buffer> {
    const cached = this.decoded.get(image.path);
    if (cached) return cached;
    const { data, info } = await sharp(await this.store.get(image.path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== image.width || info.height !== image.height || data.length !== image.width * image.height * 4) throw new Error("Corrupt stored image");
    this.remember(image.path, data);
    return data;
  }

  private remember(path: string, data: Buffer): void {
    this.decoded.delete(path);
    this.decoded.set(path, data);
    while (this.decoded.size > cacheLimit) this.decoded.delete(this.decoded.keys().next().value!);
  }
}
