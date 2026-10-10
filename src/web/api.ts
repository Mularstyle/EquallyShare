import type { ApiError, ApiErrorCode, CreateShareResponse, EndShareResponse, RecipientSnapshot, UploadTicket } from "../shared/contracts";

export type ClientErrorCode = ApiErrorCode | "NETWORK";

export class ApiFailure extends Error {
  constructor(public readonly code: ClientErrorCode, public readonly status: number, message: string, public readonly currentRevision?: number) { super(message); }
}

/** Upload limit enforced by the server (Vercel rejects bodies above 4.5 MB). Checked early for a friendlier message. */
export const maxUploadBytes = 4 * 1024 * 1024;
export const acceptedImageTypes = ["image/png", "image/jpeg", "image/webp"];
export const acceptedAudioTypes = ["audio/mpeg", "audio/mp3"];
/** Videos and PDFs upload straight to storage, so they may be larger than other files. */
export const maxDirectUploadBytes = 50 * 1024 * 1024;
export const acceptedVideoTypes = ["video/mp4"];
export const acceptedPdfTypes = ["application/pdf"];

let sessionReady: Promise<void> | undefined;

/**
 * Creates or reuses the HttpOnly session cookie. Tabs serialize the first call with Web Locks,
 * so a fresh browser opening several tabs still becomes a single Recipient.
 */
export function ensureSession(): Promise<void> {
  sessionReady ??= (async () => {
    const bootstrap = async () => { await request<void>("/api/session", { method: "POST" }); };
    if (navigator.locks) await navigator.locks.request("equallyshare-session", bootstrap);
    else await bootstrap();
  })().catch((error) => { sessionReady = undefined; throw error; });
  return sessionReady;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { credentials: "same-origin", ...init }); }
  catch { throw new ApiFailure("NETWORK", 0, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => undefined) as (T & Partial<ApiError>) | undefined;
  if (!response.ok) throw new ApiFailure(body?.code ?? "INTERNAL_ERROR", response.status, body?.message ?? response.statusText, body?.currentRevision);
  return body as T;
}

export async function createTextShare(text: string): Promise<CreateShareResponse> {
  await ensureSession();
  return request("/api/shares/text", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
}

export async function createImageShare(file: File): Promise<CreateShareResponse> {
  await ensureSession();
  const form = new FormData();
  form.append("image", file);
  return request("/api/shares/image", { method: "POST", body: form });
}

export async function createAudioShare(file: File): Promise<CreateShareResponse> {
  await ensureSession();
  const form = new FormData();
  // Some systems report MP3 files with an empty or generic type; the server sniffs the bytes anyway.
  form.append("audio", file.type === "audio/mpeg" || file.type === "audio/mp3" ? file : new File([file], file.name, { type: "audio/mpeg" }));
  return request("/api/shares/audio", { method: "POST", body: form });
}

/** PUT with upload progress (fetch cannot report it). Same-origin URLs carry the session cookie; storage URLs do not. */
function putFile(url: string, file: File, type: string, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.withCredentials = url.startsWith("/");
    xhr.setRequestHeader("content-type", type);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(1); resolve(); }
      else reject(new ApiFailure(xhr.status === 413 ? "UPLOAD_TOO_LARGE" : "INTERNAL_ERROR", xhr.status, "Upload failed"));
    };
    xhr.onerror = () => reject(new ApiFailure("NETWORK", 0, "Upload failed"));
    xhr.send(file);
  });
}

/** Video and PDF shares: reserve an upload, send the file straight to storage, then let the server validate it. */
async function createFromDirectUpload(kind: "video" | "pdf", type: string, file: File, onProgress: (fraction: number) => void): Promise<CreateShareResponse> {
  await ensureSession();
  const slot = await request<UploadTicket>(`/api/shares/${kind}/uploads`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ size: file.size, type }) });
  await putFile(slot.uploadUrl, file, type, onProgress);
  return request(`/api/shares/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ uploadId: slot.uploadId }) });
}

export const createVideoShare = (file: File, onProgress: (fraction: number) => void) => createFromDirectUpload("video", "video/mp4", file, onProgress);
export const createPdfShare = (file: File, onProgress: (fraction: number) => void) => createFromDirectUpload("pdf", "application/pdf", file, onProgress);

export async function joinShare(shareId: string): Promise<RecipientSnapshot> {
  await ensureSession();
  return request(`/api/shares/${encodeURIComponent(shareId)}/join`, { method: "POST" });
}

export async function fetchSnapshot(shareId: string): Promise<RecipientSnapshot> {
  return request(`/api/shares/${encodeURIComponent(shareId)}/snapshot`, { cache: "no-store" });
}

export async function endShare(shareId: string): Promise<EndShareResponse> {
  return request(`/api/shares/${encodeURIComponent(shareId)}/end`, { method: "POST" });
}

export type MediaResult = { kind: "media"; blob: Blob } | { kind: "stale" } | { kind: "busy" } | { kind: "empty" };

/** Fetches this Recipient's image block or audio segment for one revision. The server only ever returns the caller's own part. */
export async function fetchMedia(url: string, signal: AbortSignal): Promise<MediaResult> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", signal });
  if (response.status === 200) return { kind: "media", blob: await response.blob() };
  if (response.status === 204) return { kind: "empty" };
  if (response.status === 409) return { kind: "stale" };
  if (response.status === 503) return { kind: "busy" };
  const body = await response.json().catch(() => undefined) as Partial<ApiError> | undefined;
  throw new ApiFailure(body?.code ?? "INTERNAL_ERROR", response.status, body?.message ?? response.statusText);
}

const messages: Partial<Record<ClientErrorCode, string>> = {
  NETWORK: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง",
  INVALID_TEXT: "พิมพ์ข้อความก่อนแชร์",
  TEXT_TOO_LARGE: "ข้อความยาวเกินไป",
  INVALID_IMAGE: "รองรับเฉพาะภาพ PNG, JPEG หรือ WebP ที่ไม่ใช่ภาพเคลื่อนไหว",
  INVALID_AUDIO: "รองรับเฉพาะไฟล์เสียง MP3",
  INVALID_VIDEO: "รองรับเฉพาะวิดีโอ MP4 (H.264 แนะนำ) ที่มีภาพ",
  INVALID_PDF: "รองรับเฉพาะ PDF ที่ไม่ได้ใส่รหัสผ่าน",
  UPLOAD_NOT_FOUND: "อัปโหลดไม่สำเร็จหรือหมดเวลา ลองใหม่อีกครั้ง",
  UPLOAD_TOO_LARGE: "ไฟล์ใหญ่เกินกำหนด (วิดีโอและ PDF 50 MB, ไฟล์อื่น 4 MB)",
  SHARE_NOT_FOUND: "ไม่พบ share นี้",
  SHARE_EXPIRED: "share นี้หมดอายุแล้ว (เปิดได้ 24 ชั่วโมงหลังสร้าง)",
  SHARE_ENDED: "ผู้สร้างปิด share นี้แล้ว",
  RECIPIENT_LIMIT: "share นี้มีผู้รับครบจำนวนแล้ว",
  NOT_CREATOR: "เฉพาะผู้สร้างเท่านั้นที่ปิด share ได้",
  ORIGIN_NOT_ALLOWED: "เปิดจากเว็บไซต์ที่ไม่ได้รับอนุญาต",
  UNAUTHENTICATED: "session หมดอายุ รีเฟรชหน้าแล้วลองใหม่",
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiFailure) return messages[error.code] ?? "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
  return "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
}
