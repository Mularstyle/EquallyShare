import { resolve } from "node:path";

export type ServerConfig = {
  port: number;
  publicOrigin: string;
  dataDir: string;
  /** Supabase Postgres connection string; when absent, embedded PGlite under dataDir is used. */
  databaseUrl: string | undefined;
  /** Supabase project URL and service-role key; when absent, images stay on local disk and realtime is off. */
  supabaseUrl: string | undefined;
  supabaseServiceRoleKey: string | undefined;
  storageBucket: string;
  /** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; cleanup is disabled when unset. */
  cronSecret: string | undefined;
  sessionTtlHours: number;
  shareTtlHours: number;
  maxTextGraphemes: number;
  maxRecipients: number;
  maxUploadBytes: number;
  /** Video goes browser → storage directly, so it is not bound by Vercel's 4.5 MB request limit. */
  maxVideoUploadBytes: number;
  maxImagePixels: number;
  maxImageEdge: number;
  maxConcurrentRenders: number;
  jsonBodyLimit: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  function integer(name: string, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
    const raw = env[name];
    if (raw === undefined) return fallback;
    if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer from ${min} to ${max}`);
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}`);
    return value;
  }
  function optional(name: string): string | undefined {
    const value = env[name]?.trim();
    return value ? value : undefined;
  }
  const originText = env.PUBLIC_ORIGIN ?? "http://localhost:3000";
  let origin: URL;
  try { origin = new URL(originText); } catch { throw new Error("PUBLIC_ORIGIN must be an absolute HTTP(S) origin"); }
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || origin.origin !== originText.replace(/\/$/, "")) {
    throw new Error("PUBLIC_ORIGIN must be an absolute HTTP(S) origin without path, query or credentials");
  }
  return {
    // Local API port; Vite serves the UI on 3000 and proxies /api here.
    port: integer("PORT", 3001, 0, 65535),
    publicOrigin: origin.origin,
    // Keep the default outside Vite's project root: dev middleware can serve files inside it.
    dataDir: resolve(env.DATA_DIR ?? "../equallyshare-private-data"),
    databaseUrl: optional("DATABASE_URL"),
    supabaseUrl: optional("SUPABASE_URL"),
    supabaseServiceRoleKey: optional("SUPABASE_SERVICE_ROLE_KEY"),
    storageBucket: env.SUPABASE_STORAGE_BUCKET ?? "share-originals",
    cronSecret: optional("CRON_SECRET"),
    sessionTtlHours: integer("SESSION_TTL_HOURS", 168, 1),
    shareTtlHours: integer("SHARE_TTL_HOURS", 24, 1),
    maxTextGraphemes: integer("MAX_TEXT_GRAPHEMES", 20_000, 1),
    maxRecipients: integer("MAX_RECIPIENTS", 64, 1),
    // Vercel Functions reject request bodies above 4.5 MB.
    maxUploadBytes: integer("MAX_UPLOAD_BYTES", 4_194_304, 1),
    maxVideoUploadBytes: integer("MAX_VIDEO_UPLOAD_BYTES", 52_428_800, 1),
    maxImagePixels: integer("MAX_IMAGE_PIXELS", 12_000_000, 1),
    maxImageEdge: integer("MAX_IMAGE_EDGE", 1024, 1),
    maxConcurrentRenders: integer("MAX_CONCURRENT_RENDERS", 4, 1),
    jsonBodyLimit: integer("JSON_BODY_LIMIT", 262_144, 1),
  };
}
