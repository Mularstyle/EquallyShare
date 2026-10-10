import express, { type ErrorRequestHandler, type Express, type Request } from "express";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import multer from "multer";
import QRCode from "qrcode";
import { allocateCollage, createTileStream } from "../core/collage.js";
import type { ApiError, CreateShareResponse, RecipientSnapshot } from "../shared/contracts.js";
import type { ServerConfig } from "./config.js";
import { IdentityService, type Clock } from "./identity.js";
import { ImageService } from "./image-service.js";
import { ShareError, ShareService } from "./share-service.js";

export type AppOptions = { db: DatabaseSync; config: ServerConfig; clock?: Clock };
const cookieName = "share_session";

function readCookie(request: Request): string | undefined {
  const header = request.headers.cookie;
  const item = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  return item?.slice(cookieName.length + 1);
}

export function createApp({ db, config, clock = Date.now }: AppOptions): Express {
  const app = express();
  const identity = new IdentityService(db, clock, config.sessionTtlHours);
  const shares = new ShareService(db, clock, config);
  const images = new ImageService(config.dataDir, config.maxImagePixels, config.maxImageEdge);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files: 1, fields: 0, parts: 1 } }).single("image");
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
  app.post("/api/session", (request, response) => {
    const session = identity.ensureSession(readCookie(request));
    const secure = config.publicOrigin.startsWith("https:") ? "; Secure" : "";
    response.setHeader("Set-Cookie", `${cookieName}=${session.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${config.sessionTtlHours * 3600}${secure}`);
    response.status(204).end();
  });

  function visitor(request: Request): string {
    const id = identity.findVisitor(readCookie(request));
    if (!id) throw new ShareError("UNAUTHENTICATED", 401, "Session required");
    return id;
  }

  app.post("/api/shares/text", async (request, response, next) => {
    try {
      const snapshot = shares.createText(visitor(request), request.body?.text);
      const shareUrl = `${config.publicOrigin}/s/${encodeURIComponent(snapshot.shareId)}`;
      let qrDataUrl: string | null = null;
      try { qrDataUrl = await QRCode.toDataURL(shareUrl); }
      catch { /* Share is already committed; the URL remains usable. */ }
      response.status(201).json({ shareUrl, qrDataUrl, qrStatus: qrDataUrl ? "ready" : "unavailable", snapshot } satisfies CreateShareResponse);
    } catch (error) { next(error); }
  });

  app.post("/api/shares/image", (request, _response, next) => {
    try { visitor(request); next(); }
    catch (error) { next(error); }
  }, upload, async (request, response, next) => {
    let stored: Awaited<ReturnType<ImageService["normalizeAndStore"]>> | undefined;
    try {
      const visitorId = visitor(request);
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
      try { snapshot = shares.createImage(visitorId, stored); }
      catch (error) { await images.deleteSource(stored); throw error; }
      const shareUrl = `${config.publicOrigin}/s/${encodeURIComponent(snapshot.shareId)}`;
      let qrDataUrl: string | null = null;
      try { qrDataUrl = await QRCode.toDataURL(shareUrl); }
      catch { /* The committed share remains usable. */ }
      response.status(201).json({ shareUrl, qrDataUrl, qrStatus: qrDataUrl ? "ready" : "unavailable", snapshot } satisfies CreateShareResponse);
    } catch (error) { next(error); }
  });

  app.post("/api/shares/:shareId/join", (request, response, next) => {
    try {
      const snapshot: RecipientSnapshot = shares.join(String(request.params.shareId), visitor(request)).snapshot;
      response.json(snapshot);
    } catch (error) { next(error); }
  });

  app.get("/api/shares/:shareId/snapshot", (request, response, next) => {
    try { response.json(shares.getSnapshot(String(request.params.shareId), visitor(request))); }
    catch (error) { next(error); }
  });

  app.get("/api/shares/:shareId/collage", async (request, response, next) => {
    response.setHeader("Cache-Control", "private, no-store");
    try {
      const visitorId = visitor(request);
      const shareId = String(request.params.shareId);
      const revisionText = request.query.revision;
      if (typeof revisionText !== "string" || !/^[1-9]\d*$/.test(revisionText) || !Number.isSafeInteger(Number(revisionText))) throw new ShareError("STALE_REVISION", 409, "Valid revision required");
      const revision = Number(revisionText);
      const { image, snapshot } = shares.getImage(shareId, visitorId);
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
        const plan = allocateCollage(createTileStream(image.width, image.height, shareId), snapshot.recipientCount, snapshot.recipientNumber);
        png = await images.renderCollage(image, plan);
      } finally { activeRenders--; }
      const latest = shares.getSnapshot(shareId, visitorId);
      if (latest.revision !== revision) {
        response.status(409).json({ code: "STALE_REVISION", message: "Share revision changed", currentRevision: latest.revision, recipientCount: latest.recipientCount });
        return;
      }
      response.type("png").send(png);
    } catch (error) { next(error); }
  });

  const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      response.status(tooLarge ? 413 : 415).json({ code: tooLarge ? "UPLOAD_TOO_LARGE" : "INVALID_IMAGE", message: tooLarge ? "Image exceeds upload limit" : "Invalid image upload" } satisfies ApiError);
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
