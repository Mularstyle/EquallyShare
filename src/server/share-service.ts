import { randomUUID } from "node:crypto";
import { partitionText, segmentText } from "../core/partition.js";
import { allocateCollage, createTileStream } from "../core/collage.js";
import type { ApiErrorCode, RecipientSnapshot } from "../shared/contracts.js";
import type { Clock, VisitorId } from "./identity.js";
import type { StoredImage } from "./image-service.js";
import type { Queryable, Sql } from "./sql.js";

type ShareRow = { id: string; content_type: string; original_text: string | null; image_path: string | null; image_width: number | null; image_height: number | null; created_at: number; expires_at: number; recipient_count: number; revision: number; status: string };
type RecipientRow = { join_order: number };
export type JoinResult = { snapshot: RecipientSnapshot; joined: boolean };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ShareError extends Error {
  constructor(public readonly code: ApiErrorCode, public readonly status: number, message: string) { super(message); }
}

export class ShareService {
  constructor(private readonly sql: Sql, private readonly clock: Clock = Date.now, private readonly options: { shareTtlHours: number; maxTextGraphemes: number; maxRecipients: number } = { shareTtlHours: 24, maxTextGraphemes: 20_000, maxRecipients: 64 }) {}

  async createText(visitorId: VisitorId, text: string): Promise<RecipientSnapshot> {
    if (typeof text !== "string" || text.trim().length === 0) throw new ShareError("INVALID_TEXT", 400, "Text is required");
    const unitCount = segmentText(text).length;
    if (unitCount > this.options.maxTextGraphemes) throw new ShareError("TEXT_TOO_LARGE", 413, "Text exceeds the allowed length");
    const now = this.clock();
    const id = randomUUID();
    return this.sql.transaction(async (tx) => {
      await tx.query("INSERT INTO shares (id, content_type, original_text, image_path, image_width, image_height, created_at, expires_at, recipient_count, revision, status) VALUES ($1, 'text', $2, NULL, NULL, NULL, $3, $4, 1, 1, 'active')",
        [id, text, now, now + this.options.shareTtlHours * 3_600_000]);
      await tx.query("INSERT INTO recipients (share_id, visitor_id, join_order, joined_at) VALUES ($1, $2, 1, $3)", [id, visitorId, now]);
      return this.snapshotFor(await this.getShare(tx, id), 1);
    });
  }

  async createImage(visitorId: VisitorId, original: StoredImage): Promise<RecipientSnapshot> {
    const id = original.path.replace(/\.png$/, "");
    if (!uuidPattern.test(id) || original.path !== `${id}.png`) throw new Error("Invalid stored image");
    const now = this.clock();
    return this.sql.transaction(async (tx) => {
      await tx.query("INSERT INTO shares (id, content_type, original_text, image_path, image_width, image_height, created_at, expires_at, recipient_count, revision, status) VALUES ($1, 'image', NULL, $2, $3, $4, $5, $6, 1, 1, 'active')",
        [id, original.path, original.width, original.height, now, now + this.options.shareTtlHours * 3_600_000]);
      await tx.query("INSERT INTO recipients (share_id, visitor_id, join_order, joined_at) VALUES ($1, $2, 1, $3)", [id, visitorId, now]);
      return this.snapshotFor(await this.getShare(tx, id), 1);
    });
  }

  async getImage(shareId: string, visitorId: VisitorId): Promise<{ image: StoredImage; snapshot: RecipientSnapshot }> {
    const snapshot = await this.getSnapshot(shareId, visitorId);
    const row = await this.getShare(this.sql, shareId);
    if (row.content_type !== "image" || !row.image_path || !row.image_width || !row.image_height) throw new ShareError("INVALID_IMAGE", 400, "Share has no image");
    return { image: { path: row.image_path, width: row.image_width, height: row.image_height, totalPixels: row.image_width * row.image_height }, snapshot };
  }

  async join(shareId: string, visitorId: VisitorId): Promise<JoinResult> {
    return this.sql.transaction(async (tx) => {
      // Row lock serializes joins of the same share across concurrent function instances.
      const share = await this.getShare(tx, shareId, true);
      this.assertActive(share);
      const existing = await this.getRecipient(tx, shareId, visitorId);
      if (existing) return { snapshot: this.snapshotFor(share, existing.join_order), joined: false };
      if (share.recipient_count >= this.options.maxRecipients) throw new ShareError("RECIPIENT_LIMIT", 429, "Recipient limit reached");
      const order = share.recipient_count + 1;
      await tx.query("INSERT INTO recipients (share_id, visitor_id, join_order, joined_at) VALUES ($1, $2, $3, $4)", [shareId, visitorId, order, this.clock()]);
      await tx.query("UPDATE shares SET recipient_count = $1, revision = $2 WHERE id = $3", [order, share.revision + 1, shareId]);
      return { snapshot: this.snapshotFor({ ...share, recipient_count: order, revision: share.revision + 1 }, order), joined: true };
    });
  }

  async getSnapshot(shareId: string, visitorId: VisitorId): Promise<RecipientSnapshot> {
    const share = await this.getShare(this.sql, shareId);
    this.assertActive(share);
    const recipient = await this.getRecipient(this.sql, shareId, visitorId);
    if (!recipient) throw new ShareError("NOT_A_RECIPIENT", 403, "Join this share first");
    return this.snapshotFor(share, recipient.join_order);
  }

  private async getShare(db: Queryable, id: string, lock = false): Promise<ShareRow> {
    // Non-UUID IDs cannot exist; rejecting them here also avoids a Postgres cast error.
    const [row] = uuidPattern.test(id) ? await db.query<ShareRow>(`SELECT * FROM shares WHERE id = $1${lock ? " FOR UPDATE" : ""}`, [id]) : [];
    if (!row) throw new ShareError("SHARE_NOT_FOUND", 404, "Share not found");
    return row;
  }

  private async getRecipient(db: Queryable, shareId: string, visitorId: VisitorId): Promise<RecipientRow | undefined> {
    const [row] = await db.query<RecipientRow>("SELECT join_order FROM recipients WHERE share_id = $1 AND visitor_id = $2", [shareId, visitorId]);
    return row;
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
