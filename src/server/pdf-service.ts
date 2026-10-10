import { PDFDocument } from "pdf-lib";
import type { ImageStore } from "./image-store.js";
import { ShareError } from "./share-service.js";

export type StoredPdf = { path: string; pageCount: number };

const cacheLimit = 4;

/** Validates PDF uploads and builds per-recipient PDFs that contain only their page range. */
export class PdfService {
  private readonly loaded = new Map<string, PDFDocument>();

  constructor(private readonly store: ImageStore) {}

  async normalizeAndStore(input: Buffer, shareId: string): Promise<StoredPdf> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shareId)) throw new Error("Invalid share ID");
    let document: PDFDocument;
    let pageCount: number;
    try {
      if (input.toString("latin1", 0, 5) !== "%PDF-") throw new Error("Missing PDF header");
      // Encrypted PDFs are rejected: pages cannot be copied out of them reliably.
      document = await PDFDocument.load(input, { updateMetadata: false });
      // pdf-lib loads leniently; a missing or broken page tree only shows up here.
      pageCount = document.getPageCount();
    } catch {
      throw new ShareError("INVALID_PDF", 415, "Invalid, encrypted or unsupported PDF");
    }
    if (pageCount < 1) throw new ShareError("INVALID_PDF", 415, "PDF has no pages");
    const stored: StoredPdf = { path: `${shareId}.pdf`, pageCount };
    await this.store.put(stored.path, input);
    this.remember(stored.path, document);
    return stored;
  }

  /** A new PDF with pages [start, start + count) of the original (0-based), and nothing else from it. */
  async renderPages(path: string, start: number, count: number): Promise<Buffer> {
    const source = await this.load(path);
    if (start < 0 || count <= 0 || start + count > source.getPageCount()) throw new Error("Page range outside stored PDF");
    const output = await PDFDocument.create();
    const pages = await output.copyPages(source, Array.from({ length: count }, (_, i) => start + i));
    for (const page of pages) output.addPage(page);
    return Buffer.from(await output.save());
  }

  async deleteSource(path: string): Promise<void> {
    this.loaded.delete(path);
    await this.store.delete(path);
  }

  private async load(path: string): Promise<PDFDocument> {
    const cached = this.loaded.get(path);
    if (cached) return cached;
    const document = await PDFDocument.load(await this.store.get(path), { updateMetadata: false });
    this.remember(path, document);
    return document;
  }

  private remember(path: string, document: PDFDocument): void {
    this.loaded.delete(path);
    this.loaded.set(path, document);
    while (this.loaded.size > cacheLimit) this.loaded.delete(this.loaded.keys().next().value!);
  }
}
