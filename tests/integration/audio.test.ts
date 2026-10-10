import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import type { AudioAllocation, CreateShareResponse, RecipientSnapshot } from "../../src/shared/contracts.js";
import { frameIndexes, mp3File } from "../fixtures/mp3.js";
import { startTestServer, type TestServer } from "./test-server.js";

const servers: TestServer[] = [];
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

async function session(server: TestServer): Promise<string> {
  const response = await fetch(`${server.origin}/api/session`, { method: "POST" });
  return response.headers.get("set-cookie")!.split(";")[0]!;
}

async function upload(server: TestServer, cookie: string, bytes: Buffer, mime = "audio/mpeg") {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(bytes)], { type: mime }), "song.mp3");
  return fetch(`${server.origin}/api/shares/audio`, { method: "POST", headers: { cookie }, body: form });
}

const allocation = (snapshot: RecipientSnapshot) => snapshot.allocation as AudioAllocation;

it("divides an MP3 into contiguous time segments that re-divide on join", async () => {
  const server = await startTestServer(); servers.push(server);
  const creator = await session(server);
  const response = await upload(server, creator, mp3File(10, { id3: true, xing: true }));
  expect(response.status).toBe(201);
  const created = await response.json() as CreateShareResponse;
  expect(allocation(created.snapshot)).toMatchObject({ kind: "audio", startMs: 0, frameCount: 10, totalFrames: 10, totalDurationMs: 261 });
  const id = created.snapshot.shareId;

  const cookies = [creator];
  for (let i = 0; i < 2; i++) {
    const cookie = await session(server);
    cookies.push(cookie);
    expect((await fetch(`${server.origin}/api/shares/${id}/join`, { method: "POST", headers: { cookie } })).status).toBe(200);
  }
  const segments: number[][] = [];
  for (const cookie of cookies) {
    const snapshot = await (await fetch(`${server.origin}/api/shares/${id}/snapshot`, { headers: { cookie } })).json() as RecipientSnapshot;
    const audio = await fetch(`${server.origin}${allocation(snapshot).audioUrl}`, { headers: { cookie } });
    expect(audio.status).toBe(200);
    expect(audio.headers.get("content-type")).toContain("audio/mpeg");
    expect(audio.headers.get("cache-control")).toBe("private, no-store");
    segments.push(frameIndexes(new Uint8Array(await audio.arrayBuffer())));
  }
  // Tags and the Xing frame are gone; 10 frames split 4/3/3 in join order.
  expect(segments).toEqual([[0, 1, 2, 3], [4, 5, 6], [7, 8, 9]]);
});

it("guards membership and revision for audio segments", async () => {
  const server = await startTestServer(); servers.push(server);
  const creator = await session(server);
  const created = await (await upload(server, creator, mp3File(4))).json() as CreateShareResponse;
  const url = allocation(created.snapshot).audioUrl!;
  const stranger = await session(server);
  expect((await fetch(`${server.origin}${url}`, { headers: { cookie: stranger } })).status).toBe(403);
  await fetch(`${server.origin}/api/shares/${created.snapshot.shareId}/join`, { method: "POST", headers: { cookie: stranger } });
  const stale = await fetch(`${server.origin}${url}`, { headers: { cookie: creator } });
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({ code: "STALE_REVISION", currentRevision: 2 });
});

it("gives an empty segment without a URL when recipients outnumber frames", async () => {
  const server = await startTestServer(); servers.push(server);
  const creator = await session(server);
  const created = await (await upload(server, creator, mp3File(1))).json() as CreateShareResponse;
  const second = await session(server);
  const joined = await (await fetch(`${server.origin}/api/shares/${created.snapshot.shareId}/join`, { method: "POST", headers: { cookie: second } })).json() as RecipientSnapshot;
  expect(allocation(joined)).toMatchObject({ audioUrl: null, frameCount: 0, durationMs: 0 });
});

it("rejects non-MP3 input, wrong types and oversized files without storing anything", async () => {
  const directory = mkdtempSync(join(tmpdir(), "equallyshare-audio-")); directories.push(directory);
  const server = await startTestServer({ dataDir: directory, maxUploadBytes: 3000 }); servers.push(server);
  const cookie = await session(server);
  const cases: [Buffer, string, number, string][] = [
    [Buffer.from("definitely not audio"), "audio/mpeg", 415, "INVALID_AUDIO"],
    [mp3File(2), "image/png", 415, "INVALID_AUDIO"],
    [Buffer.concat([mp3File(1), Buffer.alloc(1500, 7)]), "audio/mpeg", 415, "INVALID_AUDIO"],
    [mp3File(10), "audio/mpeg", 413, "UPLOAD_TOO_LARGE"],
  ];
  for (const [bytes, mime, status, code] of cases) {
    const response = await upload(server, cookie, bytes, mime);
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code });
  }
  expect(await server.sql.query("SELECT id FROM shares")).toEqual([]);
  expect(readdirSync(directory).includes("originals") ? readdirSync(join(directory, "originals")) : []).toEqual([]);
});

it("removes stored MP3 originals during cleanup", async () => {
  const directory = mkdtempSync(join(tmpdir(), "equallyshare-audio-")); directories.push(directory);
  const server = await startTestServer({ dataDir: directory, cronSecret: "secret" }); servers.push(server);
  const creator = await session(server);
  const created = await (await upload(server, creator, mp3File(3))).json() as CreateShareResponse;
  expect(readdirSync(join(directory, "originals"))).toEqual([`${created.snapshot.shareId}.mp3`]);
  await fetch(`${server.origin}/api/shares/${created.snapshot.shareId}/end`, { method: "POST", headers: { cookie: creator } });
  const cleanup = await fetch(`${server.origin}/api/cron/cleanup`, { headers: { authorization: "Bearer secret" } });
  expect(await cleanup.json()).toEqual({ removedShares: 1, removedImages: 1, imageErrors: 0 });
  expect(readdirSync(join(directory, "originals"))).toEqual([]);
});
