export type ContentType = "text" | "image" | "audio" | "video" | "pdf";
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

/** A contiguous time segment of the original MP3, in join order (like the text split). */
export type AudioAllocation = {
  kind: "audio";
  audioUrl: string | null;
  startMs: number;
  durationMs: number;
  totalDurationMs: number;
  frameCount: number;
  totalFrames: number;
};

/** A contiguous time segment of the original MP4, cut at keyframes (GOPs), in join order. */
export type VideoAllocation = {
  kind: "video";
  videoUrl: string | null;
  startMs: number;
  durationMs: number;
  totalDurationMs: number;
  segmentCount: number;
  totalSegments: number;
};

/** A contiguous page range of the original PDF, in join order (like the text split). */
export type PdfAllocation = {
  kind: "pdf";
  pdfUrl: string | null;
  /** 1-based number of the first page this Recipient got (0 when they got none). */
  startPage: number;
  pageCount: number;
  totalPages: number;
};

export type RecipientSnapshot = {
  shareId: string;
  revision: number;
  status: ShareStatus;
  recipientNumber: number;
  recipientCount: number;
  maxRecipients: number;
  expiresAt: string;
  allocation: TextAllocation | ImageAllocation | AudioAllocation | VideoAllocation | PdfAllocation;
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
  | "INVALID_AUDIO"
  | "INVALID_VIDEO"
  | "INVALID_PDF"
  | "UPLOAD_NOT_FOUND"
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
/** Step 1 of a video share: the browser PUTs the MP4 to `uploadUrl`, then calls POST /api/shares/video with `uploadId`. */
export type VideoUploadTicket = { uploadId: string; uploadUrl: string };
export type CreateVideoShareRequest = { uploadId: string };

export type EndShareResponse = { shareId: string; status: "ended"; revision: number };

/** Realtime signal on Supabase channel `shareChannel(id)`. It carries no content: pages refetch their own snapshot. */
export type ShareChangedEvent = { revision: number; status: ShareStatus };
export const shareChannel = (shareId: string) => `share:${shareId}`;
export const shareChangedEvent = "share-changed";
