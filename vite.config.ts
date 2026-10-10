import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  publicDir: false,
  server: { fs: { deny: ["**/originals/**", "**/*.rgba", "**/*.sqlite*", "**/pglite/**"] } },
  build: { outDir: "dist/client", emptyOutDir: true },
});
