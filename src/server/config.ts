import { resolve } from "node:path";

export type ServerConfig = {
  port: number;
  publicOrigin: string;
  dataDir: string;
  sessionTtlHours: number;
  shareTtlHours: number;
  maxTextGraphemes: number;
  maxRecipients: number;
  maxUploadBytes: number;
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
  const originText = env.PUBLIC_ORIGIN ?? "http://localhost:3000";
  let origin: URL;
  try { origin = new URL(originText); } catch { throw new Error("PUBLIC_ORIGIN must be an absolute HTTP(S) origin"); }
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || origin.origin !== originText.replace(/\/$/, "")) {
    throw new Error("PUBLIC_ORIGIN must be an absolute HTTP(S) origin without path, query or credentials");
  }
  return {
    port: integer("PORT", 3000, 0, 65535),
    publicOrigin: origin.origin,
    // Keep the default outside Vite's project root: dev middleware can serve files inside it.
    dataDir: resolve(env.DATA_DIR ?? "../equallyshare-private-data"),
    sessionTtlHours: integer("SESSION_TTL_HOURS", 168, 1),
    shareTtlHours: integer("SHARE_TTL_HOURS", 24, 1),
    maxTextGraphemes: integer("MAX_TEXT_GRAPHEMES", 20_000, 1),
    maxRecipients: integer("MAX_RECIPIENTS", 256, 1),
    maxUploadBytes: integer("MAX_UPLOAD_BYTES", 5_242_880, 1),
    maxImagePixels: integer("MAX_IMAGE_PIXELS", 12_000_000, 1),
    maxImageEdge: integer("MAX_IMAGE_EDGE", 1024, 1),
    maxConcurrentRenders: integer("MAX_CONCURRENT_RENDERS", 4, 1),
    jsonBodyLimit: integer("JSON_BODY_LIMIT", 262_144, 1),
  };
}
