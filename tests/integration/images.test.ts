import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, expect, it, vi } from "vitest";
import type { CreateShareResponse, RecipientSnapshot } from "../../src/shared/contracts.js";
import { ImageService } from "../../src/server/image-service.js";
import { startTestServer, type TestServer } from "./test-server.js";

const servers: TestServer[] = [];
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

async function fixture(width = 7, height = 5): Promise<Buffer> {
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) { rgba[i * 4] = i + 1; rgba[i * 4 + 1] = 100; rgba[i * 4 + 2] = 200; rgba[i * 4 + 3] = 255; }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function session(server: TestServer): Promise<string> {
  const response = await fetch(`${server.origin}/api/session`, { method: "POST" });
  return response.headers.get("set-cookie")!.split(";")[0]!;
}

async function upload(server: TestServer, cookie: string, bytes: Buffer, mime = "image/png", name = "image.png") {
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(bytes)], { type: mime }), name);
  return fetch(`${server.origin}/api/shares/image`, { method: "POST", headers: { cookie }, body: form });
}

async function count(server: TestServer): Promise<number> { return (await server.sql.query<{ count: number }>("SELECT count(*) AS count FROM shares"))[0]!.count; }

it("normalizes orientation and renders only uniquely owned pixels", async () => {
  const server = await startTestServer(); servers.push(server);
  const cookie = await session(server);
  const oriented = await sharp(await fixture(2, 3)).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const response = await upload(server, cookie, oriented, "image/jpeg", "oriented.jpg");
  expect(response.status).toBe(201);
  const created = await response.json() as CreateShareResponse;
  expect(created.snapshot.allocation).toMatchObject({ kind: "image", width: 3, height: 2, totalPixels: 6, pixelCount: 6 });
  const first = await fetch(`${server.origin}${(created.snapshot.allocation as { imageUrl: string }).imageUrl}`, { headers: { cookie } });
  expect(first.status).toBe(200);
  expect(first.headers.get("cache-control")).toBe("private, no-store");
  const original = await sharp(await first.arrayBuffer()).raw().toBuffer({ resolveWithObject: true });
  expect([original.info.width, original.info.height]).toEqual([3, 2]);

  const unique = await (await upload(server, cookie, await fixture())).json() as CreateShareResponse;
  const id = unique.snapshot.shareId;

  const secondCookie = await session(server);
  const joined = await fetch(`${server.origin}/api/shares/${id}/join`, { method: "POST", headers: { cookie: secondCookie } });
  expect(joined.status).toBe(200);
  const secondSnapshot = await joined.json() as RecipientSnapshot;
  const firstSnapshot = await (await fetch(`${server.origin}/api/shares/${id}/snapshot`, { headers: { cookie } })).json() as RecipientSnapshot;
  const colors: number[] = [];
  for (const [ownerCookie, snapshot] of [[cookie, firstSnapshot], [secondCookie, secondSnapshot]] as const) {
    const url = (snapshot.allocation as { imageUrl: string }).imageUrl;
    const rendered = await fetch(`${server.origin}${url}`, { headers: { cookie: ownerCookie } });
    expect(rendered.status).toBe(200);
    const decoded = await sharp(await rendered.arrayBuffer()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < decoded.info.width * decoded.info.height; i++) if (decoded.data[i * 4 + 3] !== 0) colors.push(decoded.data[i * 4]!);
  }
  expect(colors.length).toBe(35);
  expect(new Set(colors).size).toBe(35);
});

it("rejects spoofed MIME, corrupt, animated, oversized and decoded pixel bomb input", async () => {
  const directory = mkdtempSync(join(tmpdir(), "equallyshare-images-")); directories.push(directory);
  const server = await startTestServer({ dataDir: directory, maxUploadBytes: 2000, maxImagePixels: 100 }); servers.push(server);
  const cookie = await session(server);
  const animated = await sharp(await fixture(2, 2)).gif().toBuffer();
  const animationPixels = Buffer.alloc(32, 255);
  animationPixels.fill(0, 16, 32);
  const animatedWebp = await sharp(animationPixels, { raw: { width: 2, height: 4, channels: 4, pageHeight: 2 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  const cases: [Buffer, string, number, string][] = [
    [Buffer.from("not a png"), "image/png", 415, "INVALID_IMAGE"],
    [await fixture(), "image/jpeg", 415, "INVALID_IMAGE"],
    [Buffer.concat([await fixture(), Buffer.alloc(3000)]), "image/png", 413, "UPLOAD_TOO_LARGE"],
    [animated, "image/gif", 415, "INVALID_IMAGE"],
    [animatedWebp, "image/webp", 415, "INVALID_IMAGE"],
    [await fixture(11, 10), "image/png", 415, "INVALID_IMAGE"],
  ];
  for (const [bytes, mime, status, code] of cases) {
    const response = await upload(server, cookie, bytes, mime);
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code });
    expect(await count(server)).toBe(0);
  }
  expect(existsSync(join(directory, "originals")) ? readdirSync(join(directory, "originals")) : []).toEqual([]);
});

it("returns a zero allocation without an image URL when recipients exceed pixels", async () => {
  const server = await startTestServer(); servers.push(server);
  const creator = await session(server);
  const created = await (await upload(server, creator, await fixture(1, 1))).json() as CreateShareResponse;
  const second = await session(server);
  const response = await fetch(`${server.origin}/api/shares/${created.snapshot.shareId}/join`, { method: "POST", headers: { cookie: second } });
  expect(response.status).toBe(200);
  expect((await response.json() as RecipientSnapshot).allocation).toMatchObject({ kind: "image", imageUrl: null, pixelCount: 0, width: 0, height: 0, fragmentCount: 0 });
});

it("cleans orphan source after database creation fails", async () => {
  const directory = mkdtempSync(join(tmpdir(), "equallyshare-images-")); directories.push(directory);
  const server = await startTestServer({ dataDir: directory }); servers.push(server);
  const cookie = await session(server);
  await server.sql.query("CREATE FUNCTION fail_image() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$");
  await server.sql.query("CREATE TRIGGER fail_image BEFORE INSERT ON shares FOR EACH ROW WHEN (NEW.content_type = 'image') EXECUTE FUNCTION fail_image()");
  const response = await upload(server, cookie, await fixture());
  expect(response.status).toBe(500);
  expect(await count(server)).toBe(0);
  expect(readdirSync(join(directory, "originals"))).toEqual([]);
});

it("guards membership and current revision without exposing source bytes or path", async () => {
  const directory = mkdtempSync(join(tmpdir(), "equallyshare-images-")); directories.push(directory);
  const server = await startTestServer({ dataDir: directory }); servers.push(server);
  const creator = await session(server);
  const source = await fixture();
  const created = await (await upload(server, creator, source)).json() as CreateShareResponse;
  const id = created.snapshot.shareId;
  const imageUrl = (created.snapshot.allocation as { imageUrl: string }).imageUrl;
  const stranger = await session(server);
  const forbidden = await fetch(`${server.origin}${imageUrl}`, { headers: { cookie: stranger } });
  expect(forbidden.status).toBe(403);
  expect(forbidden.headers.get("cache-control")).toBe("private, no-store");
  const newcomer = await session(server);
  await fetch(`${server.origin}/api/shares/${id}/join`, { method: "POST", headers: { cookie: newcomer } });
  const stale = await fetch(`${server.origin}${imageUrl}`, { headers: { cookie: creator } });
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({ code: "STALE_REVISION", currentRevision: 2, recipientCount: 2 });
  for (const url of [`/originals/${id}.png`, `/api/shares/${id}/original`, `/api/shares/${id}.png`]) {
    expect((await fetch(`${server.origin}${url}`, { headers: { cookie: creator } })).status).toBe(404);
  }
  const responseText = JSON.stringify(created) + JSON.stringify(await (await fetch(`${server.origin}/api/shares/${id}/snapshot`, { headers: { cookie: creator } })).json());
  expect(responseText).not.toContain(".png");
  expect(responseText).not.toContain(directory);
  expect(responseText).not.toContain(source.toString("base64"));
  expect(readdirSync(join(directory, "originals"))).toEqual([`${id}.png`]);
});

it("limits concurrent renders and discards a render after the revision changes", async () => {
  const server = await startTestServer({ maxConcurrentRenders: 1 }); servers.push(server);
  const creator = await session(server);
  const created = await (await upload(server, creator, await fixture())).json() as CreateShareResponse;
  const url = `${server.origin}${(created.snapshot.allocation as { imageUrl: string }).imageUrl}`;
  let signalStarted!: () => void;
  const started = new Promise<void>((resolve) => { signalStarted = resolve; });
  let release!: () => void;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  const render = ImageService.prototype.renderCollage;
  const spy = vi.spyOn(ImageService.prototype, "renderCollage").mockImplementation(async function (this: ImageService, image, plan) {
    signalStarted();
    await hold;
    return render.call(this, image, plan);
  });
  try {
    const pending = fetch(url, { headers: { cookie: creator } });
    await started;
    const busy = await fetch(url, { headers: { cookie: creator } });
    expect(busy.status).toBe(503);
    expect(busy.headers.get("retry-after")).toBe("1");
    expect(await busy.json()).toMatchObject({ code: "RENDER_BUSY" });
    const newcomer = await session(server);
    const join = await fetch(`${server.origin}/api/shares/${created.snapshot.shareId}/join`, { method: "POST", headers: { cookie: newcomer } });
    expect(join.status).toBe(200);
    release();
    const stale = await pending;
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: "STALE_REVISION", currentRevision: 2 });
  } finally { release(); spy.mockRestore(); }
});
