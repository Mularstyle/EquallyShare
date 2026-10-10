import { useCallback, useEffect, useRef, useState } from "react";
import type { RecipientSnapshot } from "../shared/contracts";
import { ApiFailure, endShare, errorMessage, fetchSnapshot, joinShare } from "./api";
import { subscribeToShare, type ConnectionState } from "./realtime";

export type ClosedReason = "ended" | "expired" | "not-found" | "limit" | "error";
export type SharePhase =
  | { kind: "loading" }
  | { kind: "ready"; snapshot: RecipientSnapshot }
  | { kind: "closed"; reason: ClosedReason; message: string };

function closedFrom(error: unknown): SharePhase {
  const code = error instanceof ApiFailure ? error.code : undefined;
  const reason: ClosedReason = code === "SHARE_ENDED" ? "ended" : code === "SHARE_EXPIRED" ? "expired" : code === "SHARE_NOT_FOUND" ? "not-found" : code === "RECIPIENT_LIMIT" ? "limit" : "error";
  return { kind: "closed", reason, message: errorMessage(error) };
}

/**
 * Joins the share once, then keeps this page's portion current. Realtime only says "something changed";
 * the page always refetches its own snapshot and never lets an older revision replace a newer one.
 */
export function useShare(shareId: string) {
  const [phase, setPhase] = useState<SharePhase>({ kind: "loading" });
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [offline, setOffline] = useState(false);
  const revision = useRef(0);
  const closed = useRef(false);
  const inFlight = useRef<Promise<void> | undefined>(undefined);

  const close = useCallback((next: SharePhase) => {
    closed.current = true;
    setPhase(next);
  }, []);

  const accept = useCallback((snapshot: RecipientSnapshot) => {
    if (closed.current || snapshot.revision < revision.current) return;
    revision.current = snapshot.revision;
    setPhase({ kind: "ready", snapshot });
  }, []);

  const refresh = useCallback(() => {
    if (closed.current || revision.current === 0) return Promise.resolve();
    // Coalesce bursts of signals (many people joining at once) into one request at a time.
    inFlight.current ??= fetchSnapshot(shareId)
      .then((snapshot) => { setOffline(false); accept(snapshot); })
      .catch((error: unknown) => {
        if (error instanceof ApiFailure && error.code === "NETWORK") setOffline(true);
        else if (error instanceof ApiFailure && error.status === 410 || error instanceof ApiFailure && error.status === 404) close(closedFrom(error));
      })
      .finally(() => { inFlight.current = undefined; });
    return inFlight.current;
  }, [shareId, accept, close]);

  useEffect(() => {
    closed.current = false;
    revision.current = 0;
    let cancelled = false;
    setPhase({ kind: "loading" });
    joinShare(shareId)
      .then((snapshot) => { if (!cancelled) accept(snapshot); })
      .catch((error: unknown) => { if (!cancelled) close(closedFrom(error)); });

    const unsubscribe = subscribeToShare(shareId, {
      onChange(event) {
        if (event.revision <= revision.current) return;
        if (event.status === "ended") close({ kind: "closed", reason: "ended", message: errorMessage(new ApiFailure("SHARE_ENDED", 410, "")) });
        else void refresh();
      },
      onResync() { void refresh(); },
      onState: setConnection,
    });
    const goOnline = () => { setOffline(false); void refresh(); };
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [shareId, accept, close, refresh]);

  // Shares expire on server time; switch the page over at expiresAt instead of waiting for a poll.
  const expiresAt = phase.kind === "ready" ? phase.snapshot.expiresAt : undefined;
  useEffect(() => {
    if (!expiresAt) return;
    const remaining = Date.parse(expiresAt) - Date.now();
    const timer = setTimeout(() => close({ kind: "closed", reason: "expired", message: errorMessage(new ApiFailure("SHARE_EXPIRED", 410, "")) }), Math.max(0, Math.min(remaining, 2_147_483_647)));
    return () => clearTimeout(timer);
  }, [expiresAt, close]);

  const end = useCallback(async () => {
    await endShare(shareId);
    close({ kind: "closed", reason: "ended", message: "คุณปิด share นี้แล้ว ไม่มีใครเข้าร่วมเพิ่มได้" });
  }, [shareId, close]);

  return { phase, connection, offline, refresh, end };
}
