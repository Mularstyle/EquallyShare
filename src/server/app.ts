import express, { type ErrorRequestHandler, type Express, type Request } from "express";
import { randomUUID } from "node:crypto";
import multer from "multer";
import QRCode from "qrcode";
import { allocateGridCell } from "../core/collage.js";
import type { ApiError, CreateShareResponse, EndShareResponse, RecipientSnapshot, UploadTicket } from "../shared/contracts.js";
import type { ServerConfig } from "./config.js";
import { IdentityService, type Clock } from "./identity.js";
import { AudioService } from "./audio-service.js";
import { PdfService } from "./pdf-service.js";
import { ffmpegAvailable, VideoService } from "./video-service.js";
import { ImageService } from "./image-service.js";
import { FileImageStore, SupabaseImageStore, type ImageStore } from "./image-store.js";
import { partitionRange } from "../core/partition.js";
import { NoopNotifier, SupabaseBroadcastNotifier, type ShareNotifier } from "./notifier.js";
import { ShareError, ShareService, type DirectUploadKind } from "./share-service.js";
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
  const pdf = new PdfService(imageStore);
  const video = new VideoService();
  // Video cuts run ffmpeg; queue them so a burst of joins cannot start dozens of processes at once.
  let activeCuts = 0;
  const cutQueue: (() => void)[] = [];
  const withCutSlot = async <T>(work: () => Promise<T>): Promise<T> => {
    if (activeCuts >= config.maxConcurrentRenders) await new Promise<void>((resolve) => cutQueue.push(resolve));
    activeCuts++;
    try { return await work(); }
    finally { activeCuts--; cutQueue.shift()?.(); }
  };
  const segmentsInFlight = new Map<string, Promise<void>>();
  const segmentKey = (shareId: string, start: number, count: number) => `segments/${shareId}/g${start}-${count}.mp4`;
  const pageRangeKey = (shareId: string, start: number, count: number) => `segments/${shareId}/p${start}-${count}.pdf`;
  const directUploads: Record<DirectUploadKind, { type: string; extension: string; invalid: "INVALID_VIDEO" | "INVALID_PDF" }> = {
    video: { type: "video/mp4", extension: "mp4", invalid: "INVALID_VIDEO" },
    pdf: { type: "application/pdf", extension: "pdf", invalid: "INVALID_PDF" },
  };
  const uploadKeyFor = (uploadId: string, kind: DirectUploadKind) => `uploads/${uploadId}.${directUploads[kind].extension}`;

  /**
   * Builds a derived file once per range (deduplicated across concurrent requests), keeps only the ranges
   * that match the current recipient count, and answers with a short-lived signed URL (or the local file).
   * Vercel cannot return bodies above 4.5 MB, so large media never passes through the function.
   */
  async function serveCachedRange(response: express.Response, shareId: string, key: string, currentKeys: Set<string>, contentType: string, build: () => Promise<Buffer>): Promise<void> {
    if (!await imageStore.exists(key)) {
      let pending = segmentsInFlight.get(key);
      if (!pending) {
        pending = withCutSlot(async () => {
          const data = await build();
          await imageStore.put(key, data).catch(async (error: unknown) => { if (!await imageStore.exists(key)) throw error; });
          for (const entry of await imageStore.list(`segments/${shareId}`)) {
            if (!currentKeys.has(entry.key)) await imageStore.delete(entry.key).catch(() => undefined);
          }
        }).finally(() => segmentsInFlight.delete(key));
        segmentsInFlight.set(key, pending);
      }
      await pending;
    }
    const signed = await imageStore.createDownloadUrl(key, 600);
    if (signed) { response.redirect(302, signed); return; }
    response.sendFile((imageStore as FileImageStore).path(key), { headers: { "Content-Type": contentType, "Cache-Control": "private, no-store" } });
  }

  /** Step 2 of a direct upload: checks ownership and size, and returns the uploaded bytes. Rejected files are removed by the caller. */
  async function claimUpload(request: Request, kind: DirectUploadKind) {
    const visitorId = await visitor(request);
    const uploadId = String(request.body?.uploadId ?? "");
    if (await shares.pendingUploadKind(uploadId, visitorId) !== kind) throw new ShareError("UPLOAD_NOT_FOUND", 404, "Upload not found");
    const uploadKey = uploadKeyFor(uploadId, kind);
    if (!await imageStore.exists(uploadKey)) throw new ShareError("UPLOAD_NOT_FOUND", 404, "Upload not found");
    const data = await imageStore.get(uploadKey);
    if (data.length > config.maxDirectUploadBytes) throw new ShareError("UPLOAD_TOO_LARGE", 413, "File exceeds upload limit");
    return { visitorId, uploadId, uploadKey, data };
  }

  async function discardRejectedUpload(request: Request, kind: DirectUploadKind, error: unknown): Promise<void> {
    if (!(error instanceof ShareError) || error.code === "UPLOAD_NOT_FOUND" || error.code === "UNAUTHENTICATED") return;
    const uploadId = String(request.body?.uploadId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(uploadId)) return;
    await imageStore.delete(uploadKeyFor(uploadId, kind)).catch(() => undefined);
    await shares.deletePendingUpload(uploadId).catch(() => undefined);
  }

  async function createdResponse(response: express.Response, snapshot: RecipientSnapshot): Promise<void> {
    const shareUrl = `${config.publicOrigin}/s/${encodeURIComponent(snapshot.shareId)}`;
    let qrDataUrl: string | null = null;
    try { qrDataUrl = await QRCode.toDataURL(shareUrl); }
    catch { /* The committed share remains usable. */ }
    response.status(201).json({ shareUrl, qrDataUrl, qrStatus: qrDataUrl ? "ready" : "unavailable", snapshot } satisfies CreateShareResponse);
  }
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

  app.get("/api/health", (_request, response) => { response.json({ status: "ok", video: ffmpegAvailable() }); });

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

  // PDF, step 2 (after a direct upload like video): validate, then create the share.
  app.post("/api/shares/pdf", async (request, response, next) => {
    try {
      const { visitorId, uploadId, uploadKey, data } = await claimUpload(request, "pdf");
      const shareId = randomUUID();
      const stored = await pdf.inspect(data, `${shareId}.pdf`);
      await imageStore.move(uploadKey, stored.path);
      await shares.deletePendingUpload(uploadId);
      let snapshot: RecipientSnapshot;
      try { snapshot = await shares.createPdf(visitorId, stored); }
      catch (error) { await pdf.deleteSource(stored.path); throw error; }
      await createdResponse(response, snapshot);
    } catch (error) {
      await discardRejectedUpload(request, "pdf", error);
      next(error);
    }
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
        try {
          if (path.endsWith(".mp3")) await audio.deleteSource(path);
          else if (path.endsWith(".mp4") || path.endsWith(".pdf")) {
            const shareId = path.slice(0, -4);
            if (path.endsWith(".mp4")) await video.forget(path);
            else pdf.forget(path);
            for (const entry of await imageStore.list(`segments/${shareId}`)) await imageStore.delete(entry.key);
            if (imageStore instanceof FileImageStore) await imageStore.removeFolder(`segments/${shareId}`);
            await imageStore.delete(path);
          } else await images.deleteSource({ path, width: 0, height: 0, totalPixels: 0 });
        } catch (error) { imageErrors++; console.error("Media cleanup failed", error); }
      }
      // Direct uploads that were never turned into a share.
      for (const entry of await imageStore.list("uploads")) {
        if (entry.createdAt !== undefined && entry.createdAt < clock() - 3_600_000) await imageStore.delete(entry.key).catch(() => undefined);
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

  // Step 1 for video and PDF: reserve an upload. In production the browser PUTs the file straight to Supabase Storage.
  for (const kind of ["video", "pdf"] as const) {
    app.post(`/api/shares/${kind}/uploads`, async (request, response, next) => {
      try {
        const visitorId = await visitor(request);
        const size = Number(request.body?.size);
        const { type, invalid } = directUploads[kind];
        if (request.body?.type !== type) throw new ShareError(invalid, 415, `Only ${type} is supported`);
        if (!Number.isSafeInteger(size) || size <= 0) throw new ShareError(invalid, 400, "File size is required");
        if (size > config.maxDirectUploadBytes) throw new ShareError("UPLOAD_TOO_LARGE", 413, "File exceeds upload limit");
        const uploadId = await shares.createPendingUpload(visitorId, kind);
        const uploadUrl = await imageStore.createUploadUrl(uploadKeyFor(uploadId, kind)) ?? `/api/uploads/${uploadId}`;
        response.status(201).json({ uploadId, uploadUrl } satisfies UploadTicket);
      } catch (error) { next(error); }
    });
  }

  // Local development only: storage without signed upload URLs receives the PUT through the API.
  app.put("/api/uploads/:uploadId", express.raw({ type: () => true, limit: config.maxDirectUploadBytes }), async (request, response, next) => {
    try {
      if (!(imageStore instanceof FileImageStore)) throw new ShareError("UPLOAD_NOT_FOUND", 404, "Upload directly to storage");
      const uploadId = String(request.params.uploadId);
      const kind = await shares.pendingUploadKind(uploadId, await visitor(request));
      if (!kind) throw new ShareError("UPLOAD_NOT_FOUND", 404, "Upload not found");
      if (!Buffer.isBuffer(request.body) || request.body.length === 0) throw new ShareError(directUploads[kind].invalid, 400, "Empty upload");
      await imageStore.put(uploadKeyFor(uploadId, kind), request.body);
      response.status(204).end();
    } catch (error) { next(error); }
  });

  // Video, step 2: validate the uploaded MP4, read its keyframes and create the share.
  app.post("/api/shares/video", async (request, response, next) => {
    try {
      const { visitorId, uploadId, uploadKey, data } = await claimUpload(request, "video");
      const index = video.inspect(data);
      const path = `${randomUUID()}.mp4`;
      await imageStore.move(uploadKey, path);
      await shares.deletePendingUpload(uploadId);
      let snapshot: RecipientSnapshot;
      try { snapshot = await shares.createVideo(visitorId, { path, index }); }
      catch (error) { await imageStore.delete(path); throw error; }
      await createdResponse(response, snapshot);
    } catch (error) {
      await discardRejectedUpload(request, "video", error);
      next(error);
    }
  });

  // This Recipient's current video segment only. Cuts are cached in storage per GOP range and served
  // through a short-lived signed URL (Vercel cannot return bodies above 4.5 MB, and players need range requests).
  app.get("/api/shares/:shareId/video", async (request, response, next) => {
    response.setHeader("Cache-Control", "private, no-store");
    try {
      const visitorId = await visitor(request);
      const shareId = String(request.params.shareId);
      const revisionText = request.query.revision;
      if (typeof revisionText !== "string" || !/^[1-9]\d*$/.test(revisionText) || !Number.isSafeInteger(Number(revisionText))) throw new ShareError("STALE_REVISION", 409, "Valid revision required");
      const segment = await shares.getVideo(shareId, visitorId);
      if (Number(revisionText) !== segment.snapshot.revision) {
        response.status(409).json({ code: "STALE_REVISION", message: "Share revision changed", currentRevision: segment.snapshot.revision, recipientCount: segment.snapshot.recipientCount });
        return;
      }
      if (segment.count === 0) { response.status(204).end(); return; }
      // Keep storage small: only cuts that match the current recipient count stay cached.
      const current = new Set(Array.from({ length: segment.snapshot.recipientCount }, (_, i) => {
        const range = partitionRange(segment.index.keyframesMs.length, segment.snapshot.recipientCount, i + 1);
        return segmentKey(shareId, range.start, range.length);
      }));
      await serveCachedRange(response, shareId, segmentKey(shareId, segment.start, segment.count), current, "video/mp4",
        () => video.cut(segment.path, () => imageStore.get(segment.path), segment.index, segment.start, segment.count));
    } catch (error) { next(error); }
  });

  // This Recipient's page range only, as a new PDF (cached in storage, served via a signed URL); the original never leaves the server.
  app.get("/api/shares/:shareId/pdf", async (request, response, next) => {
    response.setHeader("Cache-Control", "private, no-store");
    try {
      const visitorId = await visitor(request);
      const shareId = String(request.params.shareId);
      const revisionText = request.query.revision;
      if (typeof revisionText !== "string" || !/^[1-9]\d*$/.test(revisionText) || !Number.isSafeInteger(Number(revisionText))) throw new ShareError("STALE_REVISION", 409, "Valid revision required");
      const range = await shares.getPdf(shareId, visitorId);
      if (Number(revisionText) !== range.snapshot.revision) {
        response.status(409).json({ code: "STALE_REVISION", message: "Share revision changed", currentRevision: range.snapshot.revision, recipientCount: range.snapshot.recipientCount });
        return;
      }
      if (range.count === 0) { response.status(204).end(); return; }
      const current = new Set(Array.from({ length: range.snapshot.recipientCount }, (_, i) => {
        const pages = partitionRange(range.totalPages, range.snapshot.recipientCount, i + 1);
        return pageRangeKey(shareId, pages.start, pages.length);
      }));
      await serveCachedRange(response, shareId, pageRangeKey(shareId, range.start, range.count), current, "application/pdf",
        () => pdf.renderPages(range.path, range.start, range.count));
    } catch (error) { next(error); }
  });

  const errors: ErrorRequestHandler = (error: unknown, request, response, _next) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      const invalid = request.path.endsWith("/audio") ? "INVALID_AUDIO" : request.path.endsWith("/pdf") ? "INVALID_PDF" : "INVALID_IMAGE";
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
      const upload = request.path.startsWith("/api/uploads/");
      response.status(413).json({ code: upload ? "UPLOAD_TOO_LARGE" : "TEXT_TOO_LARGE", message: "Request body too large" } satisfies ApiError);
      return;
    }
    // The client gets a generic message; the cause goes to the server log (Vercel function logs).
    console.error(`Unhandled error on ${request.method} ${request.path}`, error);
    response.status(500).json({ code: "INTERNAL_ERROR", message: "Unexpected server error" } satisfies ApiError);
  };
  app.use(errors);
  return app;
}
