import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@mobile": fileURLToPath(new URL("./mobile/src", import.meta.url))
    }
  },
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["mobile/**/*.test.ts"],
    testTimeout: 30_000
  }
});
