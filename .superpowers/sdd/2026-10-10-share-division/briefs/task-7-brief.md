### Task 7: Package the Single-Instance Demo and Document Operations

**Files:**

- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docs/setup.md`
- Create: `docs/demo.md`
- Modify: `src/server/index.ts`
- Modify: `src/server/app.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `Project.md`
- Test: `tests/integration/shares.test.ts`

**Interfaces:**

- Consumes: build scripts and restart harness from Task 6 plus the complete app.
- Produces: compiled single-process server, container artifact and operator documentation.

```ts
export type BuiltServer = {
  origin: string;
  close(): Promise<void>;
};
export function runBuiltServer(options: {
  dataDir: string;
  publicOrigin?: string;
}): Promise<BuiltServer>;
```

- [ ] Write a failing production smoke test in `tests/integration/shares.test.ts` that builds the client/server, starts compiled output with a temporary `DATA_DIR`, loads `/`, loads `/s/<id>` via SPA fallback, calls `/api/health`, creates a share and reconnects after restart.

```ts
it("serves the compiled SPA and preserves a share across restart", async () => {
  const first = await runBuiltServer({ dataDir });
  expect((await fetch(`${first.origin}/api/health`)).status).toBe(200);
  const { shareId, cookie } = await createCompiledTextShare(first.origin, "ABCDEFGH");
  await first.close();
  const second = await runBuiltServer({ dataDir });
  expect((await fetch(`${second.origin}/s/${shareId}`)).headers.get("content-type")).toContain("text/html");
  expect((await getSnapshot(second.origin, cookie, shareId)).recipientCount).toBe(1);
  await second.close();
});
```
- [ ] Run the targeted production smoke test; expected result is failure until compiled static serving/start paths are wired.
- [ ] Configure production Express to serve `dist/client`, preserve `/api` and `/ws`, and return `index.html` only for browser routes. Build server to a documented `dist/server` entrypoint compatible with package scripts.
- [ ] Create a multi-stage `Dockerfile` pinned to Node 22, running as a non-root user, exposing the configured port and declaring `/app/data` as the persistence location. Add an HTTP healthcheck against `/api/health` if the image contains an available probe tool; otherwise document platform health path instead of installing a large tool only for healthcheck.
- [ ] Ensure graceful shutdown waits for HTTP close, WebSocket close and DB close. Startup must fail loudly if `DATA_DIR` is not writable or `PUBLIC_ORIGIN` is invalid.
- [ ] Document exact local commands, environment variables, persistent-volume requirement, HTTPS/reverse-proxy WebSocket requirement, Node 22 `node:sqlite` experimental status, single-instance limit, 24-hour cleanup and backup expectations in `docs/setup.md`.
- [ ] Write `docs/demo.md` as a short rehearsal: create text, scan QR, add Recipients 2→4, demonstrate live shrinking, open same browser tab without recount, show image collage, explain expiry and provide restart steps if network fails.
- [ ] Update `Project.md` current state, actual commands, final file structure, verified limits and remaining public/mobile verification. Keep user-confirmed product decisions distinct from technical choices made during implementation.
- [ ] Run the production smoke test, all automated checks and a container build. Start the container with an explicit test volume, create a share, restart the same container/image with the same volume and verify the share persists. Expected result is PASS for the smoke test and all checks, a successful image build, and the restarted container returning the original share at the same revision/count.
- [ ] If the user provides or authorizes a hosting target, deploy one instance with persistent storage and HTTPS, set `PUBLIC_ORIGIN`, then verify QR from a separate phone/network and WebSocket updates through N=4. If no target is provided, stop after the verified local/container artifact and report public/mobile deployment as unresolved rather than inventing infrastructure or cost.
- [ ] Final checkpoint: inspect `git diff --check`, dependency audit output, build/test results and documentation accuracy. Do not commit, push or deploy unless separately authorized.

