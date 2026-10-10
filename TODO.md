# TODO

## Completed

- [x] Scaffold Node 22/TypeScript/Vite/Vitest project and grapheme-aware text partitioning.
- [x] Add SQLite persistence, anonymous HttpOnly session identity, text shares, QR/URL creation, idempotent joins, and HTTP validation.
- [x] Add deterministic image collage allocation, image validation/storage/rendering, and recipient-only image responses.

## In progress

- ไม่มีงานค้างจาก checkpoint นี้

## Handoff checkpoint

- [x] Commit and push the verified Task 1–3 foundation (`9e206c1` to `origin/master`).

## Next

- [ ] **Blocker before Task 4:** choose how to run on Vercel (hosted DB + Blob + external realtime/polling, or Vercel frontend + separate Node backend). See Project.md Open Decisions.
- [ ] Add Creator-only End share: endpoint, `ended` status that rejects joins, realtime broadcast, and button in Creator UI.
- [ ] Add revision-safe WebSocket broadcasting, reconnect snapshots, heartbeat, and exact 24-hour expiration cleanup (Task 4).
- [ ] Build Creator/Recipient React UI, QR fallback state, Web Locks bootstrap, and responsive states.
- [ ] Add Playwright multi-browser/restart tests and bounded demo load test (64 recipients; #65 gets `429 RECIPIENT_LIMIT`).
- [ ] Add production static serving, Docker packaging, setup/demo documentation, and update Project.md with verified results.
- [ ] Verify public HTTPS/mobile QR flow on Vercel.
