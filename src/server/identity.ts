import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export type Clock = () => number;
export type VisitorId = string;
export type SessionResult = { visitorId: VisitorId; token: string; isNew: boolean };

export class IdentityService {
  constructor(private readonly db: DatabaseSync, private readonly clock: Clock = Date.now, private readonly ttlHours = 168) {}

  ensureSession(rawToken: string | undefined): SessionResult {
    const now = this.clock();
    if (rawToken && /^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
      const row = this.db.prepare("SELECT visitor_id, expires_at FROM sessions WHERE token_hash = ?").get(hash(rawToken)) as { visitor_id: string; expires_at: number } | undefined;
      if (row && row.expires_at > now) {
        this.db.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").run(now, hash(rawToken));
        return { visitorId: row.visitor_id, token: rawToken, isNew: false };
      }
    }
    const token = randomBytes(32).toString("base64url");
    const visitorId = randomUUID();
    this.db.prepare("INSERT INTO sessions (token_hash, visitor_id, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?)")
      .run(hash(token), visitorId, now, now, now + this.ttlHours * 3_600_000);
    return { visitorId, token, isNew: true };
  }

  findVisitor(rawToken: string | undefined): VisitorId | undefined {
    if (!rawToken || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return undefined;
    const now = this.clock();
    const row = this.db.prepare("SELECT visitor_id FROM sessions WHERE token_hash = ? AND expires_at > ?")
      .get(hash(rawToken), now) as { visitor_id: string } | undefined;
    if (row) this.db.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").run(now, hash(rawToken));
    return row?.visitor_id;
  }
}

function hash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
