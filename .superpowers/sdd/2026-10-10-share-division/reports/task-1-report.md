# Task 1 Report — Scaffold and Text Partitioning

## Result

Implemented the Node 22 / TypeScript scaffold, shared serialization-safe contracts, and grapheme-aware text partitioning. The allocator uses the specified quotient/remainder rule, keeps contiguous source order, returns one slice per recipient (including empty slices), and rejects recipient counts that are not positive integers with `RangeError`.

## Changed files

- `package.json`, `package-lock.json` — project metadata, Node `>=22 <23`, dependency set from the plan plus TypeScript tooling/type packages, and the requested scripts.
- `tsconfig.json`, `tsconfig.server.json` — strict shared/test checking and a runnable server/core TypeScript output path.
- `vite.config.ts`, `vitest.config.ts`, `index.html` — Vite and Vitest scaffold for later client tasks.
- `.env.example`, `.gitignore` — planned runtime defaults and local/build artifact exclusions.
- `src/shared/contracts.ts` — domain/transport DTOs and closed `ApiErrorCode` union, without framework imports.
- `src/core/partition.ts` — `segmentText`, `partitionText`, and `TextSlice`.
- `tests/unit/partition.test.ts` — canonical split, Thai grapheme/ZWJ emoji, whitespace/newline preservation, recipient-overflow allocations, empty-source allocations (N slices all `{ start: 0, length: 0, text: "" }`), and invalid count assertions.

No server or application UI implementation was added. `index.html` points to the future Task 5 entrypoint as the planned Vite shell. Empty allocation remains represented as `text: ""`; the exact user-facing Thai empty-state copy specified in Project.md is `คุณได้รับข้อมูล 0 ตัวอักษร` and belongs to the later UI task.

## Verification

- `npm install --no-audit --no-fund` — passed; generated the lockfile, installed 197 packages.
- `npm ls --depth=0` — passed; installed only the planned runtime stack, test tooling, TypeScript tooling, and required type packages.
- `npm run typecheck` — passed.
- Follow-up `npm run typecheck` after adding the empty-source regression assertion — passed.
- `npm run build` — passed; emitted `dist/server/core/partition.js` and `dist/server/shared/contracts.js`.
- Node assertions via `node --import tsx --input-type=module -e ...` — passed canonical N=1/2/3/4/9 cases, Thai grapheme and family ZWJ segmentation, whitespace/newline reconstruction, and invalid counts.
- `npm test -- tests/unit/partition.test.ts` — the initial sandbox attempts were blocked before collection by `EPERM` in Vite's resolver. Rerun with the sandbox restriction removed: 1 test file and 6 tests passed.

## Concerns

- The first in-sandbox Vitest attempt was blocked by a resolver permission restriction; the exact suite subsequently passed in an unrestricted test process.
- `dev`, `start`, `test:e2e`, and `load:demo` reference application targets that later tasks create. This task intentionally keeps `build` scoped to the presently available core/server TypeScript path; Vite client build becomes runnable when Task 5 adds the browser entrypoint.
- No commits or pushes were made.
