import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { preview } from "vite";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playwrightCli = path.join(repositoryRoot, "node_modules", "@playwright", "test", "cli.js");
const playwrightConfig = path.join(repositoryRoot, "playwright.mobile.config.ts");

const previewServer = await preview({
  configFile: path.join(repositoryRoot, "vite.mobile.config.ts"),
  preview: {
    host: "127.0.0.1",
    port: 4176,
    strictPort: true
  }
});

try {
  process.exitCode = await new Promise((resolve, reject) => {
    const playwright = spawn(
      process.execPath,
      [playwrightCli, "test", "--config", playwrightConfig],
      {
        cwd: repositoryRoot,
        stdio: "inherit",
        windowsHide: true
      }
    );

    playwright.once("error", reject);
    playwright.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Playwright terminated by ${signal}.`));
        return;
      }
      resolve(code ?? 1);
    });
  });
} finally {
  await previewServer.close();
}
