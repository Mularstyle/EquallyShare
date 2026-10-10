import { randomUUID } from "node:crypto";
import { partitionRange, partitionText, segmentText } from "../core/partition.js";
import { frameDurationMs } from "../core/mp3.js";
import { allocateGridCell } from "../core/collage.js";
import type { ApiErrorCode, RecipientSnapshot } from "../shared/contracts.js";
import type { Clock, VisitorId } from "./identity.js";
import type { StoredAudio } from "./audio-service.js";
import type { StoredImage } from "./image-service.js";
import type { Queryable, Sql } from "./sql.js";

type ShareRow = { id: string; content_type: string; original_text: string | null; image_path: string | null; image_width: number | null; image_height: number | null; audio_frame_count: number | null; audio_sample_rate: number | null; audio_samples_per_frame: number | null; created_at: number; expires_at: number; recipient_count: number; revision: number; status: string };
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

  async createAudio(visitorId: VisitorId, original: StoredAudio): Promise<RecipientSnapshot> {
    const id = original.path.replace(/\.mp3$/, "");
    if (!uuidPattern.test(id) || original.path !== `${id}.mp3` || original.frameCount < 1) throw new Error("Invalid stored audio");
    const now = this.clock();
    return this.sql.transaction(async (tx) => {
      await tx.query("INSERT INTO shares (id, content_type, image_path, audio_frame_count, audio_sample_rate, audio_samples_per_frame, created_at, expires_at, recipient_count, revision, status) VALUES ($1, 'audio', $2, $3, $4, $5, $6, $7, 1, 1, 'active')",
        [id, original.path, original.frameCount, original.sampleRate, original.samplesPerFrame, now, now + this.options.shareTtlHours * 3_600_000]);
      await tx.query("INSERT INTO recipients (share_id, visitor_id, join_order, joined_at) VALUES ($1, $2, 1, $3)", [id, visitorId, now]);
      return this.snapshotFor(await this.getShare(tx, id), 1);
    });
  }

  /** The caller's current audio segment (frame range) plus the storage key of the original. */
  async getAudio(shareId: string, visitorId: VisitorId): Promise<{ path: string; start: number; count: number; snapshot: RecipientSnapshot }> {
    const snapshot = await this.getSnapshot(shareId, visitorId);
    const row = await this.getShare(this.sql, shareId);
    if (row.content_type !== "audio" || !row.image_path || !row.audio_frame_count) throw new ShareError("INVALID_AUDIO", 400, "Share has no audio");
    const { start, length } = partitionRange(row.audio_frame_count, snapshot.recipientCount, snapshot.recipientNumber);
    return { path: row.image_path, start, count: length, snapshot };
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

  /** Only the Creator (recipient #1) can end a share. Ending is idempotent and bumps the revision once. */
  async end(shareId: string, visitorId: VisitorId): Promise<{ revision: number; changed: boolean }> {
    return this.sql.transaction(async (tx) => {
      const share = await this.getShare(tx, shareId, true);
      const recipient = await this.getRecipient(tx, shareId, visitorId);
      if (recipient?.join_order !== 1) throw new ShareError("NOT_CREATOR", 403, "Only the creator can end this share");
      if (share.status === "ended") return { revision: share.revision, changed: false };
      this.assertActive(share);
      await tx.query("UPDATE shares SET status = 'ended', revision = $1 WHERE id = $2", [share.revision + 1, shareId]);
      return { revision: share.revision + 1, changed: true };
    });
  }

  /** Deletes ended and expired shares (recipients cascade) and expired sessions; returns image keys to remove from storage. */
  async cleanup(): Promise<{ shares: number; imagePaths: string[] }> {
    const now = this.clock();
    return this.sql.transaction(async (tx) => {
      const removed = await tx.query<{ image_path: string | null }>("DELETE FROM shares WHERE status <> 'active' OR expires_at <= $1 RETURNING image_path", [now]);
      await tx.query("DELETE FROM sessions WHERE expires_at <= $1", [now]);
      return { shares: removed.length, imagePaths: removed.flatMap((row) => row.image_path ? [row.image_path] : []) };
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
    if (share.status === "ended") throw new ShareError("SHARE_ENDED", 410, "The creator ended this share");
    if (share.status === "expired" || this.clock() >= share.expires_at) throw new ShareError("SHARE_EXPIRED", 410, "Share has expired");
  }

  private snapshotFor(share: ShareRow, recipientNumber: number): RecipientSnapshot {
    if (share.content_type === "image" && share.image_width && share.image_height) {
      const image = allocateGridCell(share.image_width, share.image_height, share.recipient_count, recipientNumber);
      return {
        shareId: share.id, revision: share.revision, status: "active", recipientNumber,
        recipientCount: share.recipient_count, maxRecipients: this.options.maxRecipients, expiresAt: new Date(share.expires_at).toISOString(),
        allocation: { kind: "image", imageUrl: image.pixelCount ? `/api/shares/${encodeURIComponent(share.id)}/collage?revision=${share.revision}` : null, pixelCount: image.pixelCount, totalPixels: share.image_width * share.image_height, width: image.canvasWidth, height: image.canvasHeight, fragmentCount: image.fragments.length },
      };
    }
    if (share.content_type === "audio" && share.audio_frame_count && share.audio_sample_rate && share.audio_samples_per_frame) {
      const { start, length } = partitionRange(share.audio_frame_count, share.recipient_count, recipientNumber);
      const frameMs = frameDurationMs({ sampleRate: share.audio_sample_rate, samplesPerFrame: share.audio_samples_per_frame });
      return {
        shareId: share.id, revision: share.revision, status: "active", recipientNumber,
        recipientCount: share.recipient_count, maxRecipients: this.options.maxRecipients, expiresAt: new Date(share.expires_at).toISOString(),
        allocation: {
          kind: "audio",
          audioUrl: length ? `/api/shares/${encodeURIComponent(share.id)}/audio?revision=${share.revision}` : null,
          startMs: Math.round(start * frameMs), durationMs: Math.round(length * frameMs), totalDurationMs: Math.round(share.audio_frame_count * frameMs),
          frameCount: length, totalFrames: share.audio_frame_count,
        },
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
      maxRecipients: this.options.maxRecipients,
      expiresAt: new Date(share.expires_at).toISOString(),
      allocation: { kind: "text", text: part.text, unitCount: part.length, totalUnits: segmentText(share.original_text).length },
    };
  }
}
