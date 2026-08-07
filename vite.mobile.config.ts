import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./mobile", import.meta.url)),
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@mobile": fileURLToPath(new URL("./mobile/src", import.meta.url))
    }
  },
  build: {
    outDir: fileURLToPath(new URL("./dist-mobile", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022"
  },
  server: {
    host: "127.0.0.1",
    port: 5176,
    strictPort: true
  },
  preview: {
    host: "127.0.0.1",
    port: 4176,
    strictPort: true
  }
});
