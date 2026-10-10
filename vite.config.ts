import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiPort = process.env.PORT ?? "3001";

export default defineConfig({
  root: ".",
  plugins: [react()],
  // Only static UI assets live in public/; private data stays under DATA_DIR outside the project.
  publicDir: "public",
  server: {
    port: 3000,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
    fs: { deny: ["**/originals/**", "**/*.rgba", "**/*.sqlite*", "**/pglite/**"] },
  },
  build: { outDir: "dist/client", emptyOutDir: true },
});
