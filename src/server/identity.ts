import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Sql } from "./sql.js";

export type Clock = () => number;
export type VisitorId = string;
export type SessionResult = { visitorId: VisitorId; token: string; isNew: boolean };

export class IdentityService {
  constructor(private readonly sql: Sql, private readonly clock: Clock = Date.now, private readonly ttlHours = 168) {}

  async ensureSession(rawToken: string | undefined): Promise<SessionResult> {
    const now = this.clock();
    if (rawToken && /^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
      const [row] = await this.sql.query<{ visitor_id: string; expires_at: number }>("SELECT visitor_id, expires_at FROM sessions WHERE token_hash = $1", [hash(rawToken)]);
      if (row && row.expires_at > now) {
        await this.sql.query("UPDATE sessions SET last_seen_at = $1 WHERE token_hash = $2", [now, hash(rawToken)]);
        return { visitorId: row.visitor_id, token: rawToken, isNew: false };
      }
    }
    const token = randomBytes(32).toString("base64url");
    const visitorId = randomUUID();
    await this.sql.query("INSERT INTO sessions (token_hash, visitor_id, created_at, last_seen_at, expires_at) VALUES ($1, $2, $3, $4, $5)",
      [hash(token), visitorId, now, now, now + this.ttlHours * 3_600_000]);
    return { visitorId, token, isNew: true };
  }

  async findVisitor(rawToken: string | undefined): Promise<VisitorId | undefined> {
    if (!rawToken || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return undefined;
    const now = this.clock();
    const [row] = await this.sql.query<{ visitor_id: string }>("SELECT visitor_id FROM sessions WHERE token_hash = $1 AND expires_at > $2", [hash(rawToken), now]);
    if (row) await this.sql.query("UPDATE sessions SET last_seen_at = $1 WHERE token_hash = $2", [now, hash(rawToken)]);
    return row?.visitor_id;
  }
}

function hash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
