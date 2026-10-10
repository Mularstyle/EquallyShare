import type { ApiError, ApiErrorCode, CreateShareResponse, EndShareResponse, RecipientSnapshot } from "../shared/contracts";

export type ClientErrorCode = ApiErrorCode | "NETWORK";

export class ApiFailure extends Error {
  constructor(public readonly code: ClientErrorCode, public readonly status: number, message: string, public readonly currentRevision?: number) { super(message); }
}

/** Upload limit enforced by the server (Vercel rejects bodies above 4.5 MB). Checked early for a friendlier message. */
export const maxUploadBytes = 4 * 1024 * 1024;
export const acceptedImageTypes = ["image/png", "image/jpeg", "image/webp"];

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

export type CollageResult = { kind: "image"; blob: Blob } | { kind: "stale" } | { kind: "busy" } | { kind: "empty" };

/** Fetches this Recipient's collage for one revision. The server only ever returns the caller's own fragments. */
export async function fetchCollage(imageUrl: string, signal: AbortSignal): Promise<CollageResult> {
  const response = await fetch(imageUrl, { credentials: "same-origin", cache: "no-store", signal });
  if (response.status === 200) return { kind: "image", blob: await response.blob() };
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
  UPLOAD_TOO_LARGE: "ภาพใหญ่เกิน 4 MB",
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
