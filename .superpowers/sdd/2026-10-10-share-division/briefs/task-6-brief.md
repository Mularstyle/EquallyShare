### Task 6: Verify the Complete Multi-Browser Demo and Persistence

**Files:**

- Create: `playwright.config.ts`
- Create: `tests/e2e/share.spec.ts`
- Create: `tests/load/demo-load.ts`
- Modify: `tests/integration/test-server.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: test server from Task 2, completed HTTP/WebSocket/UI behavior from Tasks 3–5 and the stable UI hooks from Task 5.
- Produces: reusable multi-context helpers, restart harness and bounded load report for final acceptance.

```ts
export function createSeparateContexts(browser: Browser, count: number): Promise<BrowserContext[]>;
export function createTextFromUI(context: BrowserContext, text: string): Promise<string>;
export function joinFromUI(context: BrowserContext, shareUrl: string): Promise<Page>;
export function expectAllocations(
  contexts: BrowserContext[],
  expectedText: string[],
  recipientCount: number,
): Promise<void>;
export function runDemoLoad(options: {
  origin: string;
  maxRecipients: number;
  concurrency: number;
}): Promise<{ elapsedMs: number; peakRssBytes: number }>;
```

**Test harness rules:**

- Each simulated person uses a separate Playwright browser context; tabs for the same person share one context.
- Start server on an ephemeral port with a temporary persistent data directory.
- Tests may restart the process while preserving that directory.
- Use a fake/controllable server clock hook only in test mode; production API must not expose clock controls.

- [ ] Write failing E2E `text repartitions live from one to four recipients`: Creator creates `ABCDEFGH`; three new contexts join; after each join every open page shows the exact current allocation and recipient count without manual reload.
- [ ] Write failing E2E `two fresh tabs share one recipient identity`: in one brand-new context, navigate two pages to the same share concurrently before either has a session; assert count grows once and both tabs show the same recipient number.
- [ ] Write failing E2E `ninth recipient sees exact zero-character message`: preserve N=9 and assert the exact Thai copy with live status.
- [ ] Write failing E2E `image collages replace in real time`: upload a coordinate-color image, join through N=4, assert each page receives a new image URL/revision, no page fetches another recipient URL, and visible pixel-count labels decrease according to q/r.
- [ ] Write failing E2E `late image response cannot overwrite latest revision`: delay one collage response, join a new recipient, release delayed response and assert the page remains on newest revision.
- [ ] Write failing E2E `connection loss recovers latest state without new recipient`: disconnect one context, add two recipients, reconnect and assert it jumps to latest allocation with unchanged identity.
- [ ] Write integration/E2E `restores active share and rejects expired share after restart`: restart with same DB/data directory, verify active state, advance to exact expiry, restart again and assert 410/expired UI with no source served.
- [ ] Add response audit `never exposes original image bytes or another recipient allocation`: record all browser HTTP/WS responses for a Recipient and compare against unique fixture pixels and original file signature.

```ts
test("text repartitions live from one to four recipients", async ({ browser }) => {
  const people = await createSeparateContexts(browser, 4);
  const shareUrl = await createTextFromUI(people[0], "ABCDEFGH");
  await joinFromUI(people[1], shareUrl);
  await expectAllocations(people.slice(0, 2), ["ABCD", "EFGH"], 2);
  await joinFromUI(people[2], shareUrl);
  await joinFromUI(people[3], shareUrl);
  await expectAllocations(people, ["AB", "CD", "EF", "GH"], 4);
});

test("ninth recipient sees exact zero-character message", async ({ browser }) => {
  const ninth = await joinThroughRecipient(browser, 9, "ABCDEFGH");
  await expect(ninth.getByText("คุณได้รับข้อมูล 0 ตัวอักษร", { exact: true })).toBeVisible();
  await expect(ninth.getByTestId("recipient-count")).toHaveText("9");
});
```
- [ ] Run `npm run test:e2e -- tests/e2e/share.spec.ts` and `npm test -- tests/integration/shares.test.ts`; expected result is FAIL in the restart/clock/multi-context harness paths that do not exist yet, while earlier product tests remain passing.
- [ ] Add only the harness hooks needed for repeatable startup, clock and restart; keep them unavailable unless `NODE_ENV=test` and an in-process test dependency supplies them.
- [ ] Implement `tests/load/demo-load.ts`: create one text and one representative image share, join 256 unique cookie jars with bounded concurrency, assert final `recipientCount=256`, monotonic revisions and acceptable responses; attempt #257 and assert `429 RECIPIENT_LIMIT`. Report elapsed time and peak process memory without imposing an unmeasured pass threshold.
- [ ] Run `npm run test:e2e`, `npm run load:demo`, `npm test`, `npm run typecheck` and `npm run build`; expected result is all correctness checks passing and load script completing without crashes/unhandled rejections.
- [ ] Manually run the browser flow at desktop and mobile viewport widths, including copy URL and QR rendering. Record findings in `docs/demo.md`; do not claim a physical phone/public network test yet.
- [ ] Checkpoint: preserve Playwright traces/screenshots only for failures; inspect final data directory and process logs for secrets, original payloads and unexpected unhandled errors.

