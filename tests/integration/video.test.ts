import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { parseMp4 } from "../../src/core/mp4.js";
import type { CreateShareResponse, RecipientSnapshot, VideoAllocation, UploadTicket } from "../../src/shared/contracts.js";
import { makeMp4 } from "../fixtures/mp4.js";
import { startTestServer, type TestServer } from "./test-server.js";

const servers: TestServer[] = [];
const directories: string[] = [];
let clip: Buffer;
let fixtureDir: string;
beforeAll(() => { fixtureDir = mkdtempSync(join(tmpdir(), "equallyshare-mp4-")); clip = makeMp4(fixtureDir); });
afterAll(() => rmSync(fixtureDir, { recursive: true, force: true }));
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

async function server(options: { cronSecret?: string; maxVideoUploadBytes?: number } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), "equallyshare-video-")); directories.push(dataDir);
  const current = await startTestServer({ dataDir, ...options });
  servers.push(current);
  return { current, dataDir };
}
async function session(server: TestServer): Promise<string> {
  return (await fetch(`${server.origin}/api/session`, { method: "POST" })).headers.get("set-cookie")!.split(";")[0]!;
}
async function ticket(server: TestServer, cookie: string, size: number, type = "video/mp4") {
  return fetch(`${server.origin}/api/shares/video/uploads`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ size, type }) });
}
async function uploadVideo(server: TestServer, cookie: string, bytes: Buffer): Promise<Response> {
  const slot = await (await ticket(server, cookie, bytes.length)).json() as UploadTicket;
  const put = await fetch(`${server.origin}${slot.uploadUrl}`, { method: "PUT", headers: { cookie, "content-type": "video/mp4" }, body: new Uint8Array(bytes) });
  expect(put.status).toBe(204);
  return fetch(`${server.origin}/api/shares/video`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ uploadId: slot.uploadId }) });
}
const allocation = (snapshot: RecipientSnapshot) => snapshot.allocation as VideoAllocation;

it("divides an MP4 into keyframe-aligned time segments that rebuild the whole duration", async () => {
  const { current } = await server();
  const creator = await session(current);
  const response = await uploadVideo(current, creator, clip);
  expect(response.status).toBe(201);
  const created = await response.json() as CreateShareResponse;
  expect(allocation(created.snapshot)).toMatchObject({ kind: "video", startMs: 0, durationMs: 6000, totalDurationMs: 6000, segmentCount: 6, totalSegments: 6 });
  const id = created.snapshot.shareId;

  const cookies = [creator];
  for (let i = 0; i < 3; i++) {
    const cookie = await session(current);
    cookies.push(cookie);
    await fetch(`${current.origin}/api/shares/${id}/join`, { method: "POST", headers: { cookie } });
  }
  const pieces: { startMs: number; durationMs: number; actualMs: number }[] = [];
  for (const cookie of cookies) {
    const snapshot = await (await fetch(`${current.origin}/api/shares/${id}/snapshot`, { headers: { cookie } })).json() as RecipientSnapshot;
    const media = await fetch(`${current.origin}${allocation(snapshot).videoUrl}`, { headers: { cookie } });
    expect(media.status).toBe(200);
    expect(media.headers.get("content-type")).toContain("video/mp4");
    const piece = parseMp4(new Uint8Array(await media.arrayBuffer()));
    expect(piece.keyframesMs[0]).toBe(0);
    pieces.push({ startMs: allocation(snapshot).startMs, durationMs: allocation(snapshot).durationMs, actualMs: piece.durationMs });
  }
  // 6 one-second GOPs for 4 people: 2 + 2 + 1 + 1 seconds, back to back, and each cut is frame-exact.
  expect(pieces.map(({ startMs, durationMs }) => [startMs, durationMs])).toEqual([[0, 2000], [2000, 2000], [4000, 1000], [5000, 1000]]);
  expect(pieces.map((piece) => piece.actualMs)).toEqual([2000, 2000, 1000, 1000]);
});

it("keeps only cuts for the current recipient count in storage", async () => {
  const { current, dataDir } = await server();
  const creator = await session(current);
  const created = await (await uploadVideo(current, creator, clip)).json() as CreateShareResponse;
  const id = created.snapshot.shareId;
  expect((await fetch(`${current.origin}${allocation(created.snapshot).videoUrl}`, { headers: { cookie: creator } })).status).toBe(200);
  expect(readdirSync(join(dataDir, "originals", "segments", id))).toEqual(["g0-6.mp4"]);
  const visitor = await session(current);
  const joined = await (await fetch(`${current.origin}/api/shares/${id}/join`, { method: "POST", headers: { cookie: visitor } })).json() as RecipientSnapshot;
  expect((await fetch(`${current.origin}${allocation(joined).videoUrl}`, { headers: { cookie: visitor } })).status).toBe(200);
  expect(readdirSync(join(dataDir, "originals", "segments", id))).toEqual(["g3-3.mp4"]);
});

it("guards membership, revision and upload ownership", async () => {
  const { current } = await server();
  const creator = await session(current);
  const created = await (await uploadVideo(current, creator, clip)).json() as CreateShareResponse;
  const url = allocation(created.snapshot).videoUrl!;
  const stranger = await session(current);
  expect((await fetch(`${current.origin}${url}`, { headers: { cookie: stranger } })).status).toBe(403);
  await fetch(`${current.origin}/api/shares/${created.snapshot.shareId}/join`, { method: "POST", headers: { cookie: stranger } });
  const stale = await fetch(`${current.origin}${url}`, { headers: { cookie: creator } });
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({ code: "STALE_REVISION", currentRevision: 2 });

  const slot = await (await ticket(current, creator, clip.length)).json() as UploadTicket;
  const thief = await fetch(`${current.origin}${slot.uploadUrl}`, { method: "PUT", headers: { cookie: stranger }, body: new Uint8Array(clip) });
  expect(thief.status).toBe(404);
  const claim = await fetch(`${current.origin}/api/shares/video`, { method: "POST", headers: { cookie: stranger, "content-type": "application/json" }, body: JSON.stringify({ uploadId: slot.uploadId }) });
  expect(claim.status).toBe(404);
  expect(await claim.json()).toMatchObject({ code: "UPLOAD_NOT_FOUND" });
});

it("rejects wrong types, oversized videos and non-MP4 uploads without keeping files", async () => {
  const { current, dataDir } = await server();
  const cookie = await session(current);
  const wrongType = await ticket(current, cookie, 1000, "video/quicktime");
  expect(wrongType.status).toBe(415);
  expect(await wrongType.json()).toMatchObject({ code: "INVALID_VIDEO" });
  const tooBig = await ticket(current, cookie, 60 * 1024 * 1024);
  expect(tooBig.status).toBe(413);
  expect(await tooBig.json()).toMatchObject({ code: "UPLOAD_TOO_LARGE" });
  const garbage = await uploadVideo(current, cookie, Buffer.from("this is not a video file at all"));
  expect(garbage.status).toBe(415);
  expect(await garbage.json()).toMatchObject({ code: "INVALID_VIDEO" });
  expect(await current.sql.query("SELECT id FROM shares")).toEqual([]);
  expect(existsSync(join(dataDir, "originals", "uploads")) ? readdirSync(join(dataDir, "originals", "uploads")) : []).toEqual([]);
});

it("removes the original and cached cuts of a cleaned-up video share", async () => {
  const { current, dataDir } = await server({ cronSecret: "secret" });
  const creator = await session(current);
  const created = await (await uploadVideo(current, creator, clip)).json() as CreateShareResponse;
  const id = created.snapshot.shareId;
  await fetch(`${current.origin}${allocation(created.snapshot).videoUrl}`, { headers: { cookie: creator } });
  await fetch(`${current.origin}/api/shares/${id}/end`, { method: "POST", headers: { cookie: creator } });
  const cleanup = await fetch(`${current.origin}/api/cron/cleanup`, { headers: { authorization: "Bearer secret" } });
  expect(await cleanup.json()).toEqual({ removedShares: 1, removedImages: 1, imageErrors: 0 });
  expect(readdirSync(join(dataDir, "originals")).filter((name) => name !== "uploads" && name !== "segments")).toEqual([]);
  expect(existsSync(join(dataDir, "originals", "segments", id))).toBe(false);
});
