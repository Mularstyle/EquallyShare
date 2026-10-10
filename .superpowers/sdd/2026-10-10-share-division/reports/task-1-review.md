# Task 1 Review — Scaffold and Text Partitioning

## Spec verdict

**Pass with a verification caveat.** The current files implement the requested scaffold, shared DTO shapes, and pure grapheme-aware text allocation. The `q/r` calculation uses grapheme counts, assigns the remainder to the earliest recipients, keeps contiguous `start` offsets, and returns exactly one slice per recipient, including zero-length slices. `Intl.Segmenter(undefined, { granularity: "grapheme" })` is used as specified. The implementation does not trim, normalize, or otherwise alter the source string. The tests cover all named brief cases. Node is constrained to `>=22 <23`. No server or application UI source has been added.

The required Vitest command could not run its assertions in this environment because Vite's resolver receives `EPERM` while resolving `node_modules/vitest/dist/spy.js`. This is a verification gap, not an observed partition failure. The report's statement about this failure matches my independent reproduction.

## Quality verdict

**Acceptable for Task 1, pending a clean Vitest run.** The partition code is small and direct, with no unnecessary abstraction or dependency. DTOs are framework-free and serialization-safe. Dependency names match the Tech Stack and permitted tooling in the plan; `npm ls --depth=0` reports no missing top-level package. The generated lockfile is present. The current `build` script compiles the available core/shared TypeScript path; `dev`, `start`, `test:e2e`, and `load:demo` point to targets planned for later tasks, as the brief allows.

## Findings by severity

### Medium — Unit suite remains unverified

- `npm test -- tests/unit/partition.test.ts` exits 1 before test collection with `EPERM: operation not permitted, realpath .../node_modules/vitest/dist/spy.js`. Thus none of the checked-in Vitest assertions has actually passed under the test runner. Rerun this exact command in an environment where Vitest can resolve its own files before treating the Task 1 test gate as complete. This appears to be an execution-environment restriction: direct Node access to the source and direct behavior assertions work, and the reported failure occurs inside Vite resolution before the test module is loaded.

### Resolved low finding — Empty-source invariant

- Follow-up review: `tests/unit/partition.test.ts` now asserts that `partitionText("", 3)` returns three `{ start: 0, length: 0, text: "" }` slices. This closes the original test-coverage finding. The assertion also passed when exercised directly through Node/`tsx`; the Vitest suite remains blocked before collection by the separate `EPERM` issue above.

### No further findings

- The `index.html` reference to the future `src/web/main.tsx` is a scaffold placeholder, consistent with the brief's instruction to defer the app UI.
- No original-data exposure review applies to this task because it adds neither storage nor HTTP/UI delivery.
- No commit baseline exists for the new repository, so review used the current untracked files and the Task 1 brief rather than a commit diff.

## Tests and verification

- `node --version`: `v22.23.2`, within the declared engine range.
- `npm ls --depth=0`: passed; installed top-level packages match the declared dependency list.
- `npm run typecheck`: passed (both TypeScript projects).
- `npm run build`: passed; compiles the current core/shared server output.
- `npm test -- tests/unit/partition.test.ts`: failed before collection with the `EPERM` resolver error above; `0` tests ran.
- Direct Node assertions using `tsx`: passed for Thai combining mark and family ZWJ emoji segmentation, source reconstruction with whitespace/newline, nine slices with four empty allocations, grapheme-based `start`/`length`, and `RangeError` for zero recipients. The implementer additionally reported direct checks of canonical `N=1/2/3/4/9` cases; those exact assertions are present in the checked-in test file.

## Scoped re-review verdict

**The empty-source boundary finding is resolved.** The updated test has the expected exact assertion, the direct empty-source check passed, and `npm run typecheck` passed again. The overall Task 1 verdict remains **pass with a verification caveat** until Vitest can execute the suite in an environment without the resolver `EPERM` failure.
