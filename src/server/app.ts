import express, { type ErrorRequestHandler, type Express, type Request } from "express";
import { randomUUID } from "node:crypto";
import multer from "multer";
import QRCode from "qrcode";
import { allocateGridCell } from "../core/collage.js";
import type { ApiError, CreateShareResponse, EndShareResponse, RecipientSnapshot } from "../shared/contracts.js";
import type { ServerConfig } from "./config.js";
import { IdentityService, type Clock } from "./identity.js";
import { AudioService } from "./audio-service.js";
import { ImageService } from "./image-service.js";
import { FileImageStore, SupabaseImageStore, type ImageStore } from "./image-store.js";
import { NoopNotifier, SupabaseBroadcastNotifier, type ShareNotifier } from "./notifier.js";
import { ShareError, ShareService } from "./share-service.js";
import type { Sql } from "./sql.js";

export type AppOptions = { sql: Sql; config: ServerConfig; clock?: Clock; imageStore?: ImageStore; notifier?: ShareNotifier };
const cookieName = "share_session";

function readCookie(request: Request): string | undefined {
  const header = request.headers.cookie;
  const item = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return item?.slice(cookieName.length + 1);
}

export function imageStoreFor(config: ServerConfig): ImageStore {
  return config.supabaseUrl && config.supabaseServiceRoleKey ? new SupabaseImageStore(config.supabaseUrl, config.supabaseServiceRoleKey, config.storageBucket) : new FileImageStore(config.dataDir);
}

export function notifierFor(config: ServerConfig): ShareNotifier {
  return config.supabaseUrl && config.supabaseServiceRoleKey ? new SupabaseBroadcastNotifier(config.supabaseUrl, config.supabaseServiceRoleKey) : new NoopNotifier();
}

export function createApp({ sql, config, clock = Date.now, imageStore = imageStoreFor(config), notifier = notifierFor(config) }: AppOptions): Express {
  const app = express();
  const identity = new IdentityService(sql, clock, config.sessionTtlHours);
  const shares = new ShareService(sql, clock, config);
  const images = new ImageService(imageStore, config.maxImagePixels, config.maxImageEdge);
  const audio = new AudioService(imageStore);
  const uploader = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files: 1, fields: 0, parts: 1 } });
  const upload = uploader.single("image");
  const uploadAudio = uploader.single("audio");
  let activeRenders = 0;
  const allowedOrigin = config.publicOrigin;

  app.use((request, _response, next) => {
    const origin = request.headers.origin;
    if (origin && origin !== allowedOrigin) return next(new ShareError("ORIGIN_NOT_ALLOWED", 403, "Origin not allowed"));
    next();
  });
  app.use(express.json({ limit: config.jsonBodyLimit }));

  app.get("/api/health", (_request, response) => { response.json({ status: "ok" }); });

  // Browser clients serialize their first /api/session call across tabs with Web Locks.
  app.post("/api/session", async (request, response) => {
    const session = await identity.ensureSession(readCookie(request));
    const secure = config.publicOrigin.startsWith("https:") ? "; Secure" : "";
    response.setHeader("Set-Cookie", `${cookieName}=${session.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${config.sessionTtlHours * 3600}${secure}`);
    response.status(204).end();
  });

  async function visitor(request: Request): Promise<string> {
    const id = await identity.findVisitor(readCookie(request));
    if (!id) throw new ShareError("UNAUTHENTICATED", 401, "Session required");
    return id;
  }

  app.post("/api/shares/text", async (request, response, next) => {
    try {
      const snapshot = await shares.createText(await visitor(request), request.body?.text);
      const shareUrl = `${config.publicOrigin}/s/${encodeURIComponent(snapshot.shareId)}`;
      let qrDataUrl: string | null = null;
      try { qrDataUrl = await QRCode.toDataURL(shareUrl); }
      catch { /* Share is already committed; the URL remains usable. */ }
      response.status(201).json({ shareUrl, qrDataUrl, qrStatus: qrDataUrl ? "ready" : "unavailable", snapshot } satisfies CreateShareResponse);
    } catch (error) { next(error); }
  });

  app.post("/api/shares/image", async (request, _response, next) => {
    try { await visitor(request); next(); }
    catch (error) { next(error); }
  }, upload, async (request, response, next) => {
    let stored: Awaited<ReturnType<ImageService["normalizeAndStore"]>> | undefined;
    try {
      const visitorId = await visitor(request);
      const file = request.file;
      if (!file) throw new ShareError("INVALID_IMAGE", 415, "Image is required");
      const bytes = file.buffer;
      const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const webp = bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
      const expected = png ? "image/png" : jpeg ? "image/jpeg" : webp ? "image/webp" : null;
      if (!expected || file.mimetype !== expected) throw new ShareError("INVALID_IMAGE", 415, "Invalid or unsupported image");
      stored = await images.normalizeAndStore(bytes, randomUUID());
      let snapshot: RecipientSnapshot;
      try { snapshot = await shares.createImage(visitorId, stored); }
      catch (error) { await images.deleteSource(stored); throw error; }
      const shareUrl = `${config.publicOrigin}/s/${encodeURIComponent(snapshot.shareId)}`;
      let qrDataUrl: string | null = null;
      try { qrDataUrl = await QRCode.toDataURL(shareUrl); }
      catch { /* The committed share remains usable. */ }
      response.status(201).json({ shareUrl, qrDataUrl, qrStatus: qrDataUrl ? "ready" : "unavailable", snapshot } satisfies CreateShareResponse);
    } catch (error) { next(error); }
  });

  app.post("/api/shares/audio", async (request, _response, next) => {
    try { await visitor(request); next(); }
    catch (error) { next(error); }
  }, uploadAudio, async (request, response, next) => {
    try {
      const visitorId = await visitor(request);
      const file = request.file;
      if (!file) throw new ShareError("INVALID_AUDIO", 415, "MP3 file is required");
      const bytes = file.buffer;
      // Content must look like MP3 (ID3 tag or frame sync) and match the declared type.
      const sniffed = bytes.length >= 3 && (bytes.toString("ascii", 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0));
      if (!sniffed || !["audio/mpeg", "audio/mp3"].includes(file.mimetype)) throw new ShareError("INVALID_AUDIO", 415, "Invalid or unsupported MP3");
      const stored = await audio.normalizeAndStore(bytes, randomUUID());
      let snapshot: RecipientSnapshot;
      try { snapshot = await shares.createAudio(visitorId, stored); }
      catch (error) { await audio.deleteSource(stored.path); throw error; }
      const shareUrl = `${config.publicOrigin}/s/${encodeURIComponent(snapshot.shareId)}`;
      let qrDataUrl: string | null = null;
      try { qrDataUrl = await QRCode.toDataURL(shareUrl); }
      catch { /* The committed share remains usable. */ }
      response.status(201).json({ shareUrl, qrDataUrl, qrStatus: qrDataUrl ? "ready" : "unavailable", snapshot } satisfies CreateShareResponse);
    } catch (error) { next(error); }
  });

  app.post("/api/shares/:shareId/join", async (request, response, next) => {
    try {
      const { snapshot, joined } = await shares.join(String(request.params.shareId), await visitor(request));
      if (joined) {
        // The join is committed; a failed signal only delays other pages until their next fetch.
        try { await notifier.publish(snapshot.shareId, { revision: snapshot.revision, status: snapshot.status }); }
        catch (error) { console.error("Realtime publish failed", error); }
      }
      response.json(snapshot);
    } catch (error) { next(error); }
  });

  app.post("/api/shares/:shareId/end", async (request, response, next) => {
    try {
      const shareId = String(request.params.shareId);
      const { revision, changed } = await shares.end(shareId, await visitor(request));
      if (changed) {
        try { await notifier.publish(shareId, { revision, status: "ended" }); }
        catch (error) { console.error("Realtime publish failed", error); }
      }
      response.json({ shareId, status: "ended", revision } satisfies EndShareResponse);
    } catch (error) { next(error); }
  });

  // Daily Vercel Cron job; Vercel sends the CRON_SECRET as a bearer token.
  app.get("/api/cron/cleanup", async (request, response, next) => {
    try {
      if (!config.cronSecret || request.headers.authorization !== `Bearer ${config.cronSecret}`) {
        response.status(401).json({ code: "UNAUTHENTICATED", message: "Cron secret required" } satisfies ApiError);
        return;
      }
      const { shares: removed, imagePaths } = await shares.cleanup();
      let imageErrors = 0;
      for (const path of imagePaths) {
        try { await (path.endsWith(".mp3") ? audio.deleteSource(path) : images.deleteSource({ path, width: 0, height: 0, totalPixels: 0 })); }
        catch (error) { imageErrors++; console.error("Image cleanup failed", error); }
      }
      response.json({ removedShares: removed, removedImages: imagePaths.length - imageErrors, imageErrors });
    } catch (error) { next(error); }
  });

  app.get("/api/shares/:shareId/snapshot", async (request, response, next) => {
    try { response.json(await shares.getSnapshot(String(request.params.shareId), await visitor(request))); }
    catch (error) { next(error); }
  });

  app.get("/api/shares/:shareId/collage", async (request, response, next) => {
    response.setHeader("Cache-Control", "private, no-store");
    try {
      const visitorId = await visitor(request);
      const shareId = String(request.params.shareId);
      const revisionText = request.query.revision;
      if (typeof revisionText !== "string" || !/^[1-9]\d*$/.test(revisionText) || !Number.isSafeInteger(Number(revisionText))) throw new ShareError("STALE_REVISION", 409, "Valid revision required");
      const revision = Number(revisionText);
      const { image, snapshot } = await shares.getImage(shareId, visitorId);
      if (revision !== snapshot.revision) {
        response.status(409).json({ code: "STALE_REVISION", message: "Share revision changed", currentRevision: snapshot.revision, recipientCount: snapshot.recipientCount });
        return;
      }
      if (snapshot.allocation.kind !== "image" || snapshot.allocation.pixelCount === 0) { response.status(204).end(); return; }
      if (activeRenders >= config.maxConcurrentRenders) {
        response.setHeader("Retry-After", "1");
        response.status(503).json({ code: "RENDER_BUSY", message: "Rendering is busy; retry shortly" } satisfies ApiError);
        return;
      }
      activeRenders++;
      let png: Buffer;
      try {
        const plan = allocateGridCell(image.width, image.height, snapshot.recipientCount, snapshot.recipientNumber);
        png = await images.renderCollage(image, plan);
      } finally { activeRenders--; }
      const latest = await shares.getSnapshot(shareId, visitorId);
      if (latest.revision !== revision) {
        response.status(409).json({ code: "STALE_REVISION", message: "Share revision changed", currentRevision: latest.revision, recipientCount: latest.recipientCount });
        return;
      }
      response.type("png").send(png);
    } catch (error) { next(error); }
  });

  // This Recipient's current time segment only; the original MP3 never leaves the server.
  app.get("/api/shares/:shareId/audio", async (request, response, next) => {
    response.setHeader("Cache-Control", "private, no-store");
    try {
      const visitorId = await visitor(request);
      const shareId = String(request.params.shareId);
      const revisionText = request.query.revision;
      if (typeof revisionText !== "string" || !/^[1-9]\d*$/.test(revisionText) || !Number.isSafeInteger(Number(revisionText))) throw new ShareError("STALE_REVISION", 409, "Valid revision required");
      const revision = Number(revisionText);
      const segment = await shares.getAudio(shareId, visitorId);
      if (revision !== segment.snapshot.revision) {
        response.status(409).json({ code: "STALE_REVISION", message: "Share revision changed", currentRevision: segment.snapshot.revision, recipientCount: segment.snapshot.recipientCount });
        return;
      }
      if (segment.count === 0) { response.status(204).end(); return; }
      const mp3 = await audio.renderSegment(segment.path, segment.start, segment.count);
      response.type("audio/mpeg").send(mp3);
    } catch (error) { next(error); }
  });

  const errors: ErrorRequestHandler = (error: unknown, request, response, _next) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      const invalid = request.path.endsWith("/audio") ? "INVALID_AUDIO" : "INVALID_IMAGE";
      response.status(tooLarge ? 413 : 415).json({ code: tooLarge ? "UPLOAD_TOO_LARGE" : invalid, message: tooLarge ? "File exceeds upload limit" : "Invalid upload" } satisfies ApiError);
      return;
    }
    if (error instanceof ShareError) {
      response.status(error.status).json({ code: error.code, message: error.message } satisfies ApiError);
      return;
    }
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ code: "INVALID_TEXT", message: "Invalid JSON body" } satisfies ApiError);
      return;
    }
    if (error instanceof Error && "type" in error && error.type === "entity.too.large") {
      response.status(413).json({ code: "TEXT_TOO_LARGE", message: "Request body too large" } satisfies ApiError);
      return;
    }
    response.status(500).json({ code: "INTERNAL_ERROR", message: "Unexpected server error" } satisfies ApiError);
  };
  app.use(errors);
  return app;
}
