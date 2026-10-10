import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { basename, join, relative, resolve, sep } from "node:path";
import { createServer } from "vite";
import { expect, it } from "vitest";
import { loadConfig } from "../../src/server/config.js";

it("keeps default source storage outside the Vite project root", () => {
  const projectRoot = resolve(".");
  const dataDir = loadConfig({}).dataDir;
  const pathFromRoot = relative(projectRoot, dataDir);
  expect(pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== ".." && !pathFromRoot.startsWith(sep))).toBe(false);
});

it("does not serve raw source files placed inside the Vite root", async () => {
  const projectRoot = resolve(".");
  const directory = mkdtempSync(join(projectRoot, "data-visibility-"));
  const originals = join(directory, "originals");
  mkdirSync(originals);
  const filename = `${randomUUID()}.rgba`;
  const temporaryName = `.${randomUUID()}.tmp`;
  const marker = Buffer.from("private raw source image bytes");
  writeFileSync(join(originals, filename), marker);
  writeFileSync(join(originals, temporaryName), marker);
  const vite = await createServer({ configFile: join(projectRoot, "vite.config.ts"), server: { host: "127.0.0.1", port: 0 } });
  try {
    await vite.listen();
    const address = vite.httpServer!.address() as AddressInfo;
    for (const name of [filename, temporaryName]) {
      const url = `http://127.0.0.1:${address.port}/${basename(directory)}/originals/${name}`;
      const response = await fetch(url);
      expect(response.status).toBe(403);
      expect(Buffer.from(await response.arrayBuffer())).not.toEqual(marker);
    }
  } finally {
    await vite.close();
    if (!directory.startsWith(projectRoot + sep)) throw new Error("Unsafe test cleanup path");
    rmSync(directory, { recursive: true, force: true });
  }
});
