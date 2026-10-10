import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  migrateDatabase(db);
  return db;
}

export function migrateDatabase(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL CHECK (content_type IN ('text', 'image')),
      original_text TEXT,
      image_path TEXT,
      image_width INTEGER,
      image_height INTEGER,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      recipient_count INTEGER NOT NULL CHECK (recipient_count > 0),
      revision INTEGER NOT NULL CHECK (revision > 0),
      status TEXT NOT NULL CHECK (status IN ('active', 'expired'))
    );
    CREATE TABLE IF NOT EXISTS recipients (
      share_id TEXT NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
      visitor_id TEXT NOT NULL,
      join_order INTEGER NOT NULL CHECK (join_order > 0),
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (share_id, visitor_id),
      UNIQUE (share_id, join_order)
    );
    CREATE INDEX IF NOT EXISTS shares_expires_at_idx ON shares(expires_at);
  `);
}

export function immediateTransaction<T>(db: DatabaseSync, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
