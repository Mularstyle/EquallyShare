import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { shareChangedEvent, shareChannel, type ShareChangedEvent } from "../shared/contracts";

export type ConnectionState = "connecting" | "live" | "polling" | "reconnecting";

type Handlers = {
  /** A content-free signal that the share changed. */
  onChange(event: ShareChangedEvent): void;
  /** Called after (re)connecting and on every poll tick: the page should refetch its snapshot. */
  onResync(): void;
  onState(state: ConnectionState): void;
};

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
let client: SupabaseClient | undefined;

/** Without Supabase (local dev) pages poll quickly; with Realtime they still poll slowly as a safety net. */
const fallbackPollMs = 2_000;
const safetyPollMs = 20_000;

export function subscribeToShare(shareId: string, handlers: Handlers): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const poll = (ms: number) => {
    if (timer) clearInterval(timer);
    timer = setInterval(() => { if (!stopped) handlers.onResync(); }, ms);
  };
  const onVisible = () => { if (document.visibilityState === "visible") handlers.onResync(); };
  document.addEventListener("visibilitychange", onVisible);

  if (!url || !anonKey) {
    handlers.onState("polling");
    poll(fallbackPollMs);
    return () => { stopped = true; if (timer) clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }

  client ??= createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  handlers.onState("connecting");
  poll(safetyPollMs);
  let wasLive = false;
  const channel = client.channel(shareChannel(shareId))
    .on("broadcast", { event: shareChangedEvent }, ({ payload }) => handlers.onChange(payload as ShareChangedEvent))
    .subscribe((status) => {
      if (stopped) return;
      if (status === "SUBSCRIBED") {
        handlers.onState("live");
        // Events sent while disconnected are not replayed, so catch up from the server.
        if (wasLive) handlers.onResync();
        wasLive = true;
        poll(safetyPollMs);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        handlers.onState("reconnecting");
        poll(fallbackPollMs);
      }
    });

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
    void client?.removeChannel(channel);
  };
}
