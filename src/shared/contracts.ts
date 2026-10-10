export type ContentType = "text" | "image";
export type ShareStatus = "active" | "expired" | "ended";

export type TextAllocation = {
  kind: "text";
  text: string;
  unitCount: number;
  totalUnits: number;
};

export type ImageAllocation = {
  kind: "image";
  imageUrl: string | null;
  pixelCount: number;
  totalPixels: number;
  width: number;
  height: number;
  fragmentCount: number;
};

export type RecipientSnapshot = {
  shareId: string;
  revision: number;
  status: ShareStatus;
  recipientNumber: number;
  recipientCount: number;
  maxRecipients: number;
  expiresAt: string;
  allocation: TextAllocation | ImageAllocation;
};

export type CreateTextShareRequest = { text: string };
export type SessionBootstrapResponse = void;
// The browser must serialize first-time /api/session calls across tabs with Web Locks.
// The server identifies recipients only from its HttpOnly session cookie.
export type CreateShareResponse = {
  shareUrl: string;
  qrDataUrl: string | null;
  qrStatus: "ready" | "unavailable";
  snapshot: RecipientSnapshot;
};
export type ApiErrorCode =
  | "INVALID_TEXT"
  | "TEXT_TOO_LARGE"
  | "INVALID_IMAGE"
  | "UPLOAD_TOO_LARGE"
  | "ORIGIN_NOT_ALLOWED"
  | "SHARE_NOT_FOUND"
  | "SHARE_EXPIRED"
  | "SHARE_ENDED"
  | "NOT_CREATOR"
  | "UNAUTHENTICATED"
  | "NOT_A_RECIPIENT"
  | "RECIPIENT_LIMIT"
  | "STALE_REVISION"
  | "RENDER_BUSY"
  | "INTERNAL_ERROR";

export type ApiError = { code: ApiErrorCode; message: string; currentRevision?: number; recipientCount?: number };
export type EndShareResponse = { shareId: string; status: "ended"; revision: number };

/** Realtime signal on Supabase channel `shareChannel(id)`. It carries no content: pages refetch their own snapshot. */
export type ShareChangedEvent = { revision: number; status: ShareStatus };
export const shareChannel = (shareId: string) => `share:${shareId}`;
export const shareChangedEvent = "share-changed";
