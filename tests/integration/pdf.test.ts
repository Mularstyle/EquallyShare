import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, expect, it } from "vitest";
import type { CreateShareResponse, PdfAllocation, RecipientSnapshot } from "../../src/shared/contracts.js";
import { startTestServer, type TestServer } from "./test-server.js";

const servers: TestServer[] = [];
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** A PDF whose page N is (300 + N) points wide, so page identity survives copying. */
async function makePdf(pages: number, options: { encrypt?: boolean } = {}): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let n = 1; n <= pages; n++) document.addPage([300 + n, 400]).drawText(`Page ${n}`, { x: 40, y: 200, size: 32, font });
  // Classic cross-reference table so the encrypted variant has a plain `trailer` dictionary to edit.
  const bytes = Buffer.from(await document.save({ useObjectStreams: false }));
  if (!options.encrypt) return bytes;
  // pdf-lib cannot encrypt; a trailer /Encrypt entry is enough to make it refuse to load.
  const text = bytes.toString("latin1");
  const trailer = /trailer\s*<</.exec(text);
  if (!trailer) throw new Error("fixture: no classic trailer");
  return Buffer.from(text.replace(trailer[0], `${trailer[0]}\n/Encrypt 1 0 R`), "latin1");
}
const pageNumbers = async (bytes: ArrayBuffer) => (await PDFDocument.load(bytes)).getPages().map((page) => Math.round(page.getWidth()) - 300);

async function session(server: TestServer): Promise<string> {
  return (await fetch(`${server.origin}/api/session`, { method: "POST" })).headers.get("set-cookie")!.split(";")[0]!;
}
async function upload(server: TestServer, cookie: string, bytes: Buffer, mime = "application/pdf") {
  const form = new FormData();
  form.append("pdf", new Blob([new Uint8Array(bytes)], { type: mime }), "doc.pdf");
  return fetch(`${server.origin}/api/shares/pdf`, { method: "POST", headers: { cookie }, body: form });
}
const allocation = (snapshot: RecipientSnapshot) => snapshot.allocation as PdfAllocation;

it("divides a PDF into contiguous page ranges that re-divide on join", async () => {
  const server = await startTestServer(); servers.push(server);
  const creator = await session(server);
  const response = await upload(server, creator, await makePdf(10));
  expect(response.status).toBe(201);
  const created = await response.json() as CreateShareResponse;
  expect(allocation(created.snapshot)).toMatchObject({ kind: "pdf", startPage: 1, pageCount: 10, totalPages: 10 });
  const id = created.snapshot.shareId;
  const cookies = [creator];
  for (let i = 0; i < 2; i++) {
    const cookie = await session(server);
    cookies.push(cookie);
    await fetch(`${server.origin}/api/shares/${id}/join`, { method: "POST", headers: { cookie } });
  }
  const received: number[][] = [];
  for (const cookie of cookies) {
    const snapshot = await (await fetch(`${server.origin}/api/shares/${id}/snapshot`, { headers: { cookie } })).json() as RecipientSnapshot;
    const media = await fetch(`${server.origin}${allocation(snapshot).pdfUrl}`, { headers: { cookie } });
    expect(media.status).toBe(200);
    expect(media.headers.get("content-type")).toContain("application/pdf");
    expect(media.headers.get("cache-control")).toBe("private, no-store");
    received.push(await pageNumbers(await media.arrayBuffer()));
  }
  // 10 pages for 3 people: 4 + 3 + 3, in order, every page exactly once.
  expect(received).toEqual([[1, 2, 3, 4], [5, 6, 7], [8, 9, 10]]);
});

it("guards membership and revision and gives an empty range when people outnumber pages", async () => {
  const server = await startTestServer(); servers.push(server);
  const creator = await session(server);
  const created = await (await upload(server, creator, await makePdf(1))).json() as CreateShareResponse;
  const url = allocation(created.snapshot).pdfUrl!;
  const stranger = await session(server);
  expect((await fetch(`${server.origin}${url}`, { headers: { cookie: stranger } })).status).toBe(403);
  const joined = await (await fetch(`${server.origin}/api/shares/${created.snapshot.shareId}/join`, { method: "POST", headers: { cookie: stranger } })).json() as RecipientSnapshot;
  expect(allocation(joined)).toMatchObject({ pdfUrl: null, startPage: 0, pageCount: 0, totalPages: 1 });
  const stale = await fetch(`${server.origin}${url}`, { headers: { cookie: creator } });
  expect(stale.status).toBe(409);
});

it("refuses encrypted PDFs at the library level", async () => {
  await expect(PDFDocument.load(await makePdf(2, { encrypt: true }))).rejects.toThrow(/encrypt/i);
});

it("rejects non-PDF, encrypted, mislabelled and oversized files without storing anything", async () => {
  const directory = mkdtempSync(join(tmpdir(), "equallyshare-pdf-")); directories.push(directory);
  const server = await startTestServer({ dataDir: directory, maxUploadBytes: 20_000 }); servers.push(server);
  const cookie = await session(server);
  const big = await makePdf(200);
  expect(big.length).toBeGreaterThan(20_000);
  const cases: [Buffer, string, number, string][] = [
    [Buffer.from("%PDF-1.7 but then nothing that parses"), "application/pdf", 415, "INVALID_PDF"],
    [Buffer.from("plain text"), "application/pdf", 415, "INVALID_PDF"],
    [await makePdf(2, { encrypt: true }), "application/pdf", 415, "INVALID_PDF"],
    [await makePdf(2), "image/png", 415, "INVALID_PDF"],
    [big, "application/pdf", 413, "UPLOAD_TOO_LARGE"],
  ];
  for (const [bytes, mime, status, code] of cases) {
    const response = await upload(server, cookie, bytes, mime);
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code });
  }
  expect(await server.sql.query("SELECT id FROM shares")).toEqual([]);
  expect(existsSync(join(directory, "originals")) ? readdirSync(join(directory, "originals")) : []).toEqual([]);
});

it("removes stored PDF originals during cleanup", async () => {
  const directory = mkdtempSync(join(tmpdir(), "equallyshare-pdf-")); directories.push(directory);
  const server = await startTestServer({ dataDir: directory, cronSecret: "secret" }); servers.push(server);
  const creator = await session(server);
  const created = await (await upload(server, creator, await makePdf(3))).json() as CreateShareResponse;
  expect(readdirSync(join(directory, "originals"))).toEqual([`${created.snapshot.shareId}.pdf`]);
  await fetch(`${server.origin}/api/shares/${created.snapshot.shareId}/end`, { method: "POST", headers: { cookie: creator } });
  const cleanup = await fetch(`${server.origin}/api/cron/cleanup`, { headers: { authorization: "Bearer secret" } });
  expect(await cleanup.json()).toEqual({ removedShares: 1, removedImages: 1, imageErrors: 0 });
  expect(readdirSync(join(directory, "originals"))).toEqual([]);
});
