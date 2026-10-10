import { defineConfig } from "vitest/config";

export default defineConfig({
  // Integration tests each start an embedded Postgres and some run ffmpeg; files run in parallel,
  // so the 5 s default is too tight under load.
  test: { environment: "node", include: ["tests/**/*.test.ts"], globals: true, testTimeout: 30_000, hookTimeout: 30_000 },
});
