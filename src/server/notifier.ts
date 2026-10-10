import type { ShareStatus } from "../shared/contracts.js";

/** Realtime signal only: carries no share content, so recipients refetch their own snapshot over HTTP. */
export type ShareChangedEvent = { revision: number; status: ShareStatus };

export interface ShareNotifier {
  publish(shareId: string, event: ShareChangedEvent): Promise<void>;
}

export const shareChannel = (shareId: string) => `share:${shareId}`;
export const shareChangedEvent = "share-changed";

export class NoopNotifier implements ShareNotifier {
  async publish(): Promise<void> {}
}

/** Supabase Realtime Broadcast through its REST endpoint; no socket is held open by the function. */
export class SupabaseBroadcastNotifier implements ShareNotifier {
  constructor(private readonly url: string, private readonly serviceRoleKey: string) {}

  async publish(shareId: string, event: ShareChangedEvent): Promise<void> {
    const response = await fetch(`${this.url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: this.serviceRoleKey, authorization: `Bearer ${this.serviceRoleKey}` },
      body: JSON.stringify({ messages: [{ topic: shareChannel(shareId), event: shareChangedEvent, payload: event, private: false }] }),
    });
    if (!response.ok) throw new Error(`Realtime broadcast failed with ${response.status}`);
  }
}
