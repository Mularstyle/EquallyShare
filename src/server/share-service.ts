import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { partitionText, segmentText } from "../core/partition.js";
import { allocateCollage, createTileStream } from "../core/collage.js";
import type { ApiErrorCode, RecipientSnapshot } from "../shared/contracts.js";
import { immediateTransaction } from "./db.js";
import type { Clock, VisitorId } from "./identity.js";
import type { StoredImage } from "./image-service.js";

type ShareRow = { id: string; content_type: string; original_text: string | null; image_path: string | null; image_width: number | null; image_height: number | null; created_at: number; expires_at: number; recipient_count: number; revision: number; status: string };
type RecipientRow = { join_order: number };
export type JoinResult = { snapshot: RecipientSnapshot; joined: boolean };

export class ShareError extends Error {
  constructor(public readonly code: ApiErrorCode, public readonly status: number, message: string) { super(message); }
}

export class ShareService {
  constructor(private readonly db: DatabaseSync, private readonly clock: Clock = Date.now, private readonly options: { shareTtlHours: number; maxTextGraphemes: number; maxRecipients: number } = { shareTtlHours: 24, maxTextGraphemes: 20_000, maxRecipients: 64 }) {}

  createText(visitorId: VisitorId, text: string): RecipientSnapshot {
    if (typeof text !== "string" || text.trim().length === 0) throw new ShareError("INVALID_TEXT", 400, "Text is required");
    const unitCount = segmentText(text).length;
    if (unitCount > this.options.maxTextGraphemes) throw new ShareError("TEXT_TOO_LARGE", 413, "Text exceeds the allowed length");
    const now = this.clock();
    const id = randomUUID();
    return immediateTransaction(this.db, () => {
      this.db.prepare("INSERT INTO shares (id, content_type, original_text, image_path, image_width, image_height, created_at, expires_at, recipient_count, revision, status) VALUES (?, 'text', ?, NULL, NULL, NULL, ?, ?, 1, 1, 'active')")
        .run(id, text, now, now + this.options.shareTtlHours * 3_600_000);
      this.db.prepare("INSERT INTO recipients (share_id, visitor_id, join_order, joined_at) VALUES (?, ?, 1, ?)").run(id, visitorId, now);
      return this.snapshotFor(this.getShare(id), 1);
    });
  }

  createImage(visitorId: VisitorId, original: StoredImage): RecipientSnapshot {
    const id = original.path.replace(/\.rgba$/, "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || original.path !== `${id}.rgba`) throw new Error("Invalid stored image");
    const now = this.clock();
    return immediateTransaction(this.db, () => {
      this.db.prepare("INSERT INTO shares (id, content_type, original_text, image_path, image_width, image_height, created_at, expires_at, recipient_count, revision, status) VALUES (?, 'image', NULL, ?, ?, ?, ?, ?, 1, 1, 'active')")
        .run(id, original.path, original.width, original.height, now, now + this.options.shareTtlHours * 3_600_000);
      this.db.prepare("INSERT INTO recipients (share_id, visitor_id, join_order, joined_at) VALUES (?, ?, 1, ?)").run(id, visitorId, now);
      return this.snapshotFor(this.getShare(id), 1);
    });
  }

  getImage(shareId: string, visitorId: VisitorId): { image: StoredImage; snapshot: RecipientSnapshot } {
    const snapshot = this.getSnapshot(shareId, visitorId);
    const row = this.getShare(shareId);
    if (row.content_type !== "image" || !row.image_path || !row.image_width || !row.image_height) throw new ShareError("INVALID_IMAGE", 400, "Share has no image");
    return { image: { path: row.image_path, width: row.image_width, height: row.image_height, totalPixels: row.image_width * row.image_height }, snapshot };
  }

  join(shareId: string, visitorId: VisitorId): JoinResult {
    return immediateTransaction(this.db, () => {
      const share = this.getShare(shareId);
      this.assertActive(share);
      const existing = this.getRecipient(shareId, visitorId);
      if (existing) return { snapshot: this.snapshotFor(share, existing.join_order), joined: false };
      if (share.recipient_count >= this.options.maxRecipients) throw new ShareError("RECIPIENT_LIMIT", 429, "Recipient limit reached");
      const order = share.recipient_count + 1;
      this.db.prepare("INSERT INTO recipients (share_id, visitor_id, join_order, joined_at) VALUES (?, ?, ?, ?)").run(shareId, visitorId, order, this.clock());
      this.db.prepare("UPDATE shares SET recipient_count = ?, revision = ? WHERE id = ?").run(order, share.revision + 1, shareId);
      return { snapshot: this.snapshotFor({ ...share, recipient_count: order, revision: share.revision + 1 }, order), joined: true };
    });
  }

  getSnapshot(shareId: string, visitorId: VisitorId): RecipientSnapshot {
    const share = this.getShare(shareId);
    this.assertActive(share);
    const recipient = this.getRecipient(shareId, visitorId);
    if (!recipient) throw new ShareError("NOT_A_RECIPIENT", 403, "Join this share first");
    return this.snapshotFor(share, recipient.join_order);
  }

  private getShare(id: string): ShareRow {
    const row = this.db.prepare("SELECT * FROM shares WHERE id = ?").get(id) as ShareRow | undefined;
    if (!row) throw new ShareError("SHARE_NOT_FOUND", 404, "Share not found");
    return row;
  }

  private getRecipient(shareId: string, visitorId: VisitorId): RecipientRow | undefined {
    return this.db.prepare("SELECT join_order FROM recipients WHERE share_id = ? AND visitor_id = ?").get(shareId, visitorId) as RecipientRow | undefined;
  }

  private assertActive(share: ShareRow): void {
    if (share.status === "expired" || this.clock() >= share.expires_at) throw new ShareError("SHARE_EXPIRED", 410, "Share has expired");
  }

  private snapshotFor(share: ShareRow, recipientNumber: number): RecipientSnapshot {
    if (share.content_type === "image" && share.image_width && share.image_height) {
      const image = allocateCollage(createTileStream(share.image_width, share.image_height, share.id), share.recipient_count, recipientNumber);
      return {
        shareId: share.id, revision: share.revision, status: "active", recipientNumber,
        recipientCount: share.recipient_count, expiresAt: new Date(share.expires_at).toISOString(),
        allocation: { kind: "image", imageUrl: image.pixelCount ? `/api/shares/${encodeURIComponent(share.id)}/collage?revision=${share.revision}` : null, pixelCount: image.pixelCount, totalPixels: share.image_width * share.image_height, width: image.canvasWidth, height: image.canvasHeight, fragmentCount: image.fragments.length },
      };
    }
    if (share.content_type !== "text" || share.original_text === null) throw new Error("Unsupported share content");
    const all = partitionText(share.original_text, share.recipient_count);
    const part = all[recipientNumber - 1]!;
    return {
      shareId: share.id,
      revision: share.revision,
      status: "active",
      recipientNumber,
      recipientCount: share.recipient_count,
      expiresAt: new Date(share.expires_at).toISOString(),
      allocation: { kind: "text", text: part.text, unitCount: part.length, totalUnits: segmentText(share.original_text).length },
    };
  }
}
