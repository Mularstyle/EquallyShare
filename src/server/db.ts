import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ServerConfig } from "./config.js";
import { createPgliteSql, createPostgresSql, type Sql } from "./sql.js";

// Row level security is enabled with no policies: the backend connects as the table owner,
// while Supabase's public anon key (shipped to browsers for Realtime) can read nothing.
export const schemaSql = `
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    visitor_id UUID NOT NULL UNIQUE,
    created_at BIGINT NOT NULL,
    last_seen_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS shares (
    id UUID PRIMARY KEY,
    content_type TEXT NOT NULL,
    original_text TEXT,
    -- Storage key of the original (image PNG or MP3), despite the historical name.
    image_path TEXT,
    image_width INTEGER,
    image_height INTEGER,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    recipient_count INTEGER NOT NULL CHECK (recipient_count > 0),
    revision INTEGER NOT NULL CHECK (revision > 0),
    status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'ended'))
  );
  CREATE TABLE IF NOT EXISTS recipients (
    share_id UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
    visitor_id UUID NOT NULL,
    join_order INTEGER NOT NULL CHECK (join_order > 0),
    joined_at BIGINT NOT NULL,
    PRIMARY KEY (share_id, visitor_id),
    UNIQUE (share_id, join_order)
  );
  CREATE INDEX IF NOT EXISTS shares_expires_at_idx ON shares(expires_at);
  ALTER TABLE shares ADD COLUMN IF NOT EXISTS audio_frame_count INTEGER;
  ALTER TABLE shares ADD COLUMN IF NOT EXISTS audio_sample_rate INTEGER;
  ALTER TABLE shares ADD COLUMN IF NOT EXISTS audio_samples_per_frame INTEGER;
  ALTER TABLE shares DROP CONSTRAINT IF EXISTS shares_content_type_check;
  ALTER TABLE shares ADD CONSTRAINT shares_content_type_check CHECK (content_type IN ('text', 'image', 'audio'));
  ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
  ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;
`;

export async function migrateDatabase(sql: Sql): Promise<void> {
  for (const statement of schemaSql.split(";").map((part) => part.trim()).filter(Boolean)) await sql.query(statement);
}

/** Production uses DATABASE_URL (Supabase Postgres); local dev and tests use embedded PGlite under DATA_DIR. */
export async function openDatabase(config: Pick<ServerConfig, "databaseUrl" | "dataDir">, options: { inMemory?: boolean } = {}): Promise<Sql> {
  if (config.databaseUrl) return createPostgresSql(config.databaseUrl);
  let directory: string | undefined;
  if (!options.inMemory) {
    directory = join(config.dataDir, "pglite");
    mkdirSync(directory, { recursive: true });
  }
  const sql = await createPgliteSql(directory);
  await migrateDatabase(sql);
  return sql;
}
