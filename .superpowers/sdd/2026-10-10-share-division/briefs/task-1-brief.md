### Task 1: Scaffold the App and Lock Text Partitioning

**Files:**

- Create: `package.json`, `package-lock.json`
- Create: `tsconfig.json`, `tsconfig.server.json`, `vite.config.ts`, `vitest.config.ts`
- Create: `.env.example`, `.gitignore`, `index.html`
- Create: `src/shared/contracts.ts`
- Create: `src/core/partition.ts`
- Test: `tests/unit/partition.test.ts`

**Interfaces:**

- Consumes: exact text behavior from `Project.md`; no application code.
- Produces: shared DTOs plus the pure text functions below for Task 2 onward.

```ts
export type TextSlice = { start: number; length: number; text: string };
export function segmentText(text: string): string[];
export function partitionText(
  text: string,
  recipientCount: number,
): TextSlice[];
```

- [ ] Initialize npm metadata and install only the dependencies named in Tech Stack, plus `typescript`, `tsx`, `concurrently` and type packages required by compilation. Require Node `>=22 <23`; commit the generated lockfile only if the user later requests a commit.
- [ ] Add scripts `dev`, `test`, `test:e2e`, `typecheck`, `build`, `start` and `load:demo`. At this task, `test`, `typecheck` and the core TypeScript build path must already be runnable; later tasks fill the app targets.
- [ ] Write failing `partitionText` tests with exact assertions:
  - `partitions canonical ABCDEFGH examples`: N=1 → `ABCDEFGH`, N=2 → `ABCD|EFGH`, N=3 → `ABC|DEF|GH`, N=4 → `AB|CD|EF|GH`.
  - `partitions Thai graphemes and emoji without splitting clusters`: use `Intl.Segmenter("th", { granularity: "grapheme" })` as the expected unit boundary, including a combining-mark Thai sample and an emoji ZWJ sequence.
  - `preserves spaces and newlines`: concatenating all slices equals the exact source bytes represented as the original JS string.
  - `returns normal empty allocations when recipients exceed units`: `ABCDEFGH`, N=9 gives `A`…`H`, `""`; all nine slices exist.
  - `rejects invalid recipient counts`: zero, negative and non-integer values throw a typed programmer error.

```ts
it("partitions canonical ABCDEFGH examples", () => {
  expect(partitionText("ABCDEFGH", 2).map((part) => part.text)).toEqual(["ABCD", "EFGH"]);
  expect(partitionText("ABCDEFGH", 4).map((part) => part.text)).toEqual(["AB", "CD", "EF", "GH"]);
});

it("returns normal empty allocations when recipients exceed units", () => {
  expect(partitionText("ABCDEFGH", 9).map((part) => part.text)).toEqual([
    "A", "B", "C", "D", "E", "F", "G", "H", "",
  ]);
});

it("partitions Thai graphemes and emoji without splitting clusters", () => {
  const family = "👨‍👩‍👧‍👦";
  expect(segmentText(`ก้${family}ข`)).toEqual(["ก้", family, "ข"]);
  expect(partitionText(`ก้${family}ข`, 3).map((part) => part.text)).toEqual(["ก้", family, "ข"]);
});
```
- [ ] Run `npm test -- tests/unit/partition.test.ts`; expected result is failure because `segmentText`/`partitionText` do not exist.
- [ ] Implement `segmentText` with `Intl.Segmenter(undefined, { granularity: "grapheme" })`. Implement the specified `q/r`, `start`, `length` algorithm over grapheme arrays; do not trim, normalize or mutate text.
- [ ] Add shared DTO types from Domain and Transport Contracts plus a closed `ApiErrorCode` union. Keep types serialization-safe and free of framework imports.
- [ ] Run `npm test -- tests/unit/partition.test.ts` and `npm run typecheck`; expected result is all assertions passing with no type errors.
- [ ] Checkpoint: inspect dependency list, lockfile and diff; verify no server, UI or unused abstraction was introduced.

