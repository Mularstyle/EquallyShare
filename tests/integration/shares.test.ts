import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import type { Sql } from "../../src/server/sql.js";
import type { CreateShareResponse, RecipientSnapshot } from "../../src/shared/contracts.js";
import { startTestServer, type TestServer } from "./test-server.js";

const servers: TestServer[] = [];
const dataDirs: string[] = [];
const fixedNow = Date.UTC(2026, 9, 10, 0, 0, 0);
async function server(dataDir?: string) {
  const value = await startTestServer({ clock: () => fixedNow, ...(dataDir ? { dataDir } : {}) });
  servers.push(value);
  return value;
}
afterEach(async () => {
  await Promise.all(servers.splice(0).map((item) => item.close()));
  for (const path of dataDirs.splice(0)) rmSync(path, { recursive: true, force: true });
});

async function session(origin: string, cookie?: string) {
  const response = await fetch(`${origin}/api/session`, { method: "POST", headers: cookie ? { cookie } : {} });
  expect(response.status).toBe(204);
  return response.headers.get("set-cookie")!.split(";")[0]!;
}
async function create(origin: string, cookie: string, text: unknown) {
  return fetch(`${origin}/api/shares/text`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ text }) });
}
async function joinShare(origin: string, cookie: string, shareId: string) {
  const response = await fetch(`${origin}/api/shares/${shareId}/join`, { method: "POST", headers: { cookie } });
  expect(response.status).toBe(200);
  return response.json() as Promise<RecipientSnapshot>;
}
async function rows(sql: Sql, table: "shares" | "recipients" | "sessions") {
  return (await sql.query<{ count: number }>(`SELECT count(*) AS count FROM ${table}`))[0]!.count;
}
async function revision(sql: Sql, id: string) {
  return (await sql.query<{ revision: number }>("SELECT revision FROM shares WHERE id = $1", [id]))[0]!.revision;
}

it("creates creator as recipient one at revision one", async () => {
  const current = await server();
  const cookie = await session(current.origin);
  const response = await create(current.origin, cookie, "ABCDEFGH");
  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.snapshot).toMatchObject({ recipientNumber: 1, recipientCount: 1, revision: 1, allocation: { kind: "text", text: "ABCDEFGH", unitCount: 8, totalUnits: 8 } });
  expect(body.shareUrl).toBe(`http://localhost:3000/s/${body.snapshot.shareId}`);
  expect(body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  expect(body.qrStatus).toBe("ready");
  expect(await rows(current.sql, "recipients")).toBe(1);
});

it("joins new visitors in stable order and recomputes canonical text", async () => {
  const current = await server();
  const creator = await session(current.origin);
  const created = await (await create(current.origin, creator, "ABCDEFGH")).json();
  const id = created.snapshot.shareId;
  const cookies = [creator];
  for (let number = 2; number <= 4; number++) {
    const cookie = await session(current.origin);
    cookies.push(cookie);
    expect(await joinShare(current.origin, cookie, id)).toMatchObject({ recipientNumber: number, recipientCount: number, revision: number });
  }
  const snapshots = await Promise.all(cookies.map(async (cookie) => {
    const response = await fetch(`${current.origin}/api/shares/${id}/snapshot`, { headers: { cookie } });
    return response.json() as Promise<RecipientSnapshot>;
  }));
  expect(snapshots.map((s) => s.allocation.kind === "text" ? s.allocation.text : null)).toEqual(["AB", "CD", "EF", "GH"]);
});

it("refresh, reconnect and repeated join keep the same count and revision", async () => {
  const current = await server();
  const cookie = await session(current.origin);
  const id = (await (await create(current.origin, cookie, "ABCDEFGH")).json()).snapshot.shareId;
  expect(await session(current.origin, cookie)).toBe(cookie);
  const snapshots = await Promise.all([joinShare(current.origin, cookie, id), joinShare(current.origin, cookie, id)]);
  expect(snapshots.every((s) => s.recipientCount === 1 && s.revision === 1)).toBe(true);
  expect(await rows(current.sql, "recipients")).toBe(1);
  expect(await rows(current.sql, "sessions")).toBe(1);
});

it("reuses the server session cookie idempotently", async () => {
  const current = await server();
  const cookie = await session(current.origin);
  const id = (await (await create(current.origin, cookie, "ABCDEFGH")).json()).snapshot.shareId;
  const [firstSession, secondSession] = await Promise.all([
    fetch(`${current.origin}/api/session`, { method: "POST", headers: { cookie } }),
    fetch(`${current.origin}/api/session`, { method: "POST", headers: { cookie } }),
  ]);
  expect([firstSession.status, secondSession.status]).toEqual([204, 204]);
  expect(firstSession.headers.get("set-cookie")?.split(";")[0]).toBe(cookie);
  expect(secondSession.headers.get("set-cookie")?.split(";")[0]).toBe(cookie);
  const [left, right] = await Promise.all([joinShare(current.origin, cookie, id), joinShare(current.origin, cookie, id)]);
  expect([left.recipientNumber, right.recipientNumber]).toEqual([1, 1]);
  expect([left.recipientCount, right.recipientCount, left.revision, right.revision]).toEqual([1, 1, 1, 1]);
  expect(await rows(current.sql, "recipients")).toBe(1);
  expect(await rows(current.sql, "sessions")).toBe(1);
});

it("serializes different concurrent visitors without duplicate join order", async () => {
  const current = await server();
  const cookie = await session(current.origin);
  const id = (await (await create(current.origin, cookie, "ABCDEFGH")).json()).snapshot.shareId;
  const visitors = await Promise.all(Array.from({ length: 12 }, () => session(current.origin)));
  const snapshots = await Promise.all(visitors.map((visitor) => joinShare(current.origin, visitor, id)));
  expect(new Set(snapshots.map((item) => item.recipientNumber)).size).toBe(12);
  expect(await rows(current.sql, "recipients")).toBe(13);
  expect(await revision(current.sql, id)).toBe(13);
});

it("persists active share, session and order after database reopen", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "equallyshare-persist-"));
  dataDirs.push(dataDir);
  const first = await server(dataDir);
  const creator = await session(first.origin);
  const id = (await (await create(first.origin, creator, "ABCDEFGH")).json()).snapshot.shareId;
  const secondCookie = await session(first.origin);
  await joinShare(first.origin, secondCookie, id);
  await first.close();
  servers.splice(servers.indexOf(first), 1);
  const second = await server(dataDir);
  expect(await joinShare(second.origin, creator, id)).toMatchObject({ recipientNumber: 1, recipientCount: 2, revision: 2, allocation: { text: "ABCD" } });
  expect(await joinShare(second.origin, secondCookie, id)).toMatchObject({ recipientNumber: 2, recipientCount: 2, revision: 2, allocation: { text: "EFGH" } });
});

it("rejects empty text and text above configured grapheme limit", async () => {
  const current = await server();
  const cookie = await session(current.origin);
  for (const value of ["", "  ", null]) {
    const response = await create(current.origin, cookie, value);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_TEXT" });
  }
  const response = await create(current.origin, cookie, "A".repeat(20_001));
  expect(response.status).toBe(413);
  expect(await response.json()).toMatchObject({ code: "TEXT_TOO_LARGE" });
  expect(await rows(current.sql, "shares")).toBe(0);
});

it("expires at the exact 24-hour boundary without extending on join", async () => {
  let now = fixedNow;
  const current = await startTestServer({ clock: () => now });
  servers.push(current);
  const creator = await session(current.origin);
  const id = (await (await create(current.origin, creator, "ABCDEFGH")).json()).snapshot.shareId;
  now += 24 * 3_600_000 - 1;
  const visitor = await session(current.origin);
  expect((await joinShare(current.origin, visitor, id)).recipientNumber).toBe(2);
  now += 1;
  const response = await fetch(`${current.origin}/api/shares/${id}/join`, { method: "POST", headers: { cookie: creator } });
  expect(response.status).toBe(410);
  expect(await response.json()).toMatchObject({ code: "SHARE_EXPIRED" });
  const snapshot = await fetch(`${current.origin}/api/shares/${id}/snapshot`, { headers: { cookie: creator } });
  expect(snapshot.status).toBe(410);
  expect(await snapshot.json()).toMatchObject({ code: "SHARE_EXPIRED" });
});

it("requires membership for snapshot and keeps tokens and QR out of the database", async () => {
  const current = await server();
  const creator = await session(current.origin);
  const body = await (await create(current.origin, creator, "ABCDEFGH")).json();
  const stranger = await session(current.origin);
  const response = await fetch(`${current.origin}/api/shares/${body.snapshot.shareId}/snapshot`, { headers: { cookie: stranger } });
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ code: "NOT_A_RECIPIENT" });
  const token = creator.split("=")[1]!;
  const sessionRows = await current.sql.query("SELECT * FROM sessions");
  expect(JSON.stringify(sessionRows)).not.toContain(token);
  const shareRows = await current.sql.query("SELECT * FROM shares");
  expect(JSON.stringify(shareRows)).not.toContain(body.qrDataUrl);
  expect(JSON.stringify(shareRows)).not.toContain("image/png");
  const foreignKeys = await current.sql.query("SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'recipients' AND constraint_type = 'FOREIGN KEY'");
  expect(foreignKeys).toHaveLength(1);
});

it("returns a usable creation response when QR generation fails after commit", async () => {
  const longOrigin = `https://${Array.from({ length: 50 }, () => "a".repeat(60)).join(".")}.com`;
  const current = await startTestServer({ publicOrigin: longOrigin });
  servers.push(current);
  const cookie = await session(current.origin);
  const response = await create(current.origin, cookie, "ABCDEFGH");
  expect(response.status).toBe(201);
  const body = await response.json() as CreateShareResponse;
  expect(body).toMatchObject({ qrDataUrl: null, qrStatus: "unavailable", snapshot: { recipientNumber: 1, recipientCount: 1 } });
  expect(body.shareUrl).toBe(`${longOrigin}/s/${body.snapshot.shareId}`);
  expect(await joinShare(current.origin, cookie, body.snapshot.shareId)).toMatchObject({ revision: 1, recipientCount: 1 });
  expect(await rows(current.sql, "shares")).toBe(1);
});

it("allows configured Origin and rejects foreign Origin without mutation", async () => {
  const current = await server();
  const allowed = "http://localhost:3000";
  const rejected = await fetch(`${current.origin}/api/session`, { method: "POST", headers: { origin: "https://foreign.example" } });
  expect(rejected.status).toBe(403);
  expect(await rejected.json()).toMatchObject({ code: "ORIGIN_NOT_ALLOWED" });
  expect(await rows(current.sql, "sessions")).toBe(0);
  const response = await fetch(`${current.origin}/api/session`, { method: "POST", headers: { origin: allowed } });
  expect(response.status).toBe(204);
  const cookie = response.headers.get("set-cookie")!.split(";")[0]!;
  const badCreate = await fetch(`${current.origin}/api/shares/text`, { method: "POST", headers: { origin: "https://foreign.example", cookie, "content-type": "application/json" }, body: JSON.stringify({ text: "ABC" }) });
  expect(badCreate.status).toBe(403);
  expect(await badCreate.json()).toMatchObject({ code: "ORIGIN_NOT_ALLOWED" });
  expect(await rows(current.sql, "shares")).toBe(0);
  const goodCreate = await fetch(`${current.origin}/api/shares/text`, { method: "POST", headers: { origin: allowed, cookie, "content-type": "application/json" }, body: JSON.stringify({ text: "ABC" }) });
  expect(goodCreate.status).toBe(201);
});

it("sets HttpOnly SameSite and path cookie attributes, plus Secure for HTTPS", async () => {
  const http = await server();
  const httpResponse = await fetch(`${http.origin}/api/session`, { method: "POST" });
  const httpCookie = httpResponse.headers.get("set-cookie")!;
  expect(httpCookie).toContain("HttpOnly");
  expect(httpCookie).toContain("SameSite=Lax");
  expect(httpCookie).toContain("Path=/");
  expect(httpCookie).not.toContain("Secure");
  const https = await startTestServer({ publicOrigin: "https://share.example" });
  servers.push(https);
  const httpsResponse = await fetch(`${https.origin}/api/session`, { method: "POST", headers: { origin: "https://share.example" } });
  expect(httpsResponse.status).toBe(204);
  expect(httpsResponse.headers.get("set-cookie")).toContain("Secure");
});

it("maps missing and invalid cookies, unknown shares, and recipient limit", async () => {
  const current = await startTestServer({ maxRecipients: 1 });
  servers.push(current);
  const creator = await session(current.origin);
  const id = (await (await create(current.origin, creator, "ABCDEFGH")).json() as CreateShareResponse).snapshot.shareId;
  const noCookie = await fetch(`${current.origin}/api/shares/${id}/join`, { method: "POST" });
  expect(noCookie.status).toBe(401);
  expect(await noCookie.json()).toMatchObject({ code: "UNAUTHENTICATED" });
  const invalidCookie = await fetch(`${current.origin}/api/shares/${id}/snapshot`, { headers: { cookie: "share_session=invalid" } });
  expect(invalidCookie.status).toBe(401);
  expect(await invalidCookie.json()).toMatchObject({ code: "UNAUTHENTICATED" });
  const unknown = await fetch(`${current.origin}/api/shares/${crypto.randomUUID()}/join`, { method: "POST", headers: { cookie: creator } });
  expect(unknown.status).toBe(404);
  expect(await unknown.json()).toMatchObject({ code: "SHARE_NOT_FOUND" });
  const visitor = await session(current.origin);
  const limited = await fetch(`${current.origin}/api/shares/${id}/join`, { method: "POST", headers: { cookie: visitor } });
  expect(limited.status).toBe(429);
  expect(await limited.json()).toMatchObject({ code: "RECIPIENT_LIMIT" });
  expect(await rows(current.sql, "recipients")).toBe(1);
  expect(await revision(current.sql, id)).toBe(1);
});

it("publishes a content-free realtime signal only when a new recipient joins", async () => {
  const current = await server();
  const creator = await session(current.origin);
  const id = (await (await create(current.origin, creator, "ABCDEFGH")).json() as CreateShareResponse).snapshot.shareId;
  await joinShare(current.origin, creator, id);
  expect(current.events).toEqual([]);
  const visitor = await session(current.origin);
  await joinShare(current.origin, visitor, id);
  await joinShare(current.origin, visitor, id);
  expect(current.events).toEqual([{ shareId: id, event: { revision: 2, status: "active" } }]);
});

it("keeps a committed join when the realtime signal fails", async () => {
  const current = await startTestServer({ notifier: { async publish() { throw new Error("realtime down"); } } });
  servers.push(current);
  const creator = await session(current.origin);
  const id = (await (await create(current.origin, creator, "ABCDEFGH")).json() as CreateShareResponse).snapshot.shareId;
  const visitor = await session(current.origin);
  expect(await joinShare(current.origin, visitor, id)).toMatchObject({ recipientNumber: 2, recipientCount: 2, revision: 2 });
  expect(await rows(current.sql, "recipients")).toBe(2);
});

it("enables row level security on every table so the public Supabase key reads nothing", async () => {
  const current = await server();
  const tables = await current.sql.query<{ relname: string; relrowsecurity: boolean }>("SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('sessions', 'shares', 'recipients') ORDER BY relname");
  expect(tables).toEqual([{ relname: "recipients", relrowsecurity: true }, { relname: "sessions", relrowsecurity: true }, { relname: "shares", relrowsecurity: true }]);
});
