import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../../src/server/app.js";
import { loadConfig } from "../../src/server/config.js";
import { openDatabase } from "../../src/server/db.js";
import type { Clock } from "../../src/server/identity.js";
import type { ShareChangedEvent, ShareNotifier } from "../../src/server/notifier.js";
import type { Sql } from "../../src/server/sql.js";

export type TestServer = {
  origin: string;
  sql: Sql;
  /** Realtime signals the app published, in order. */
  events: { shareId: string; event: ShareChangedEvent }[];
  close(): Promise<void>;
};

export async function startTestServer(options: { clock?: Clock; dataDir?: string; publicOrigin?: string; maxRecipients?: number; maxUploadBytes?: number; maxImagePixels?: number; maxConcurrentRenders?: number; notifier?: ShareNotifier } = {}): Promise<TestServer> {
  const owned = !options.dataDir;
  const dataDir = options.dataDir ?? mkdtempSync(join(tmpdir(), "equallyshare-"));
  const config = loadConfig({ DATA_DIR: dataDir, PUBLIC_ORIGIN: options.publicOrigin ?? "http://localhost:3000", ...(options.maxRecipients ? { MAX_RECIPIENTS: String(options.maxRecipients) } : {}), ...(options.maxUploadBytes ? { MAX_UPLOAD_BYTES: String(options.maxUploadBytes) } : {}), ...(options.maxImagePixels ? { MAX_IMAGE_PIXELS: String(options.maxImagePixels) } : {}), ...(options.maxConcurrentRenders ? { MAX_CONCURRENT_RENDERS: String(options.maxConcurrentRenders) } : {}) });
  // A caller-supplied dataDir gets an on-disk database so reopen/persistence can be tested.
  const sql = await openDatabase(config, { inMemory: owned });
  const events: TestServer["events"] = [];
  const notifier: ShareNotifier = options.notifier ?? { async publish(shareId, event) { events.push({ shareId, event }); } };
  const app = createApp({ sql, config, notifier, ...(options.clock ? { clock: options.clock } : {}) });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${address.port}`;
  // Test transport is ephemeral; public share links remain derived from configured PUBLIC_ORIGIN.
  return {
    origin,
    sql,
    events,
    async close() {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await sql.close();
      if (owned) rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
