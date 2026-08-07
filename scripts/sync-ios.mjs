import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const cli = path.join("node_modules", "@capacitor", "cli", "bin", "capacitor");
const vite = path.join("node_modules", "vite", "bin", "vite.js");
const build = spawnSync(process.execPath, [vite, "build", "--config", "vite.mobile.config.ts"], {
  stdio: "inherit"
});
if (build.status !== 0) process.exit(build.status ?? 1);

const sync = spawnSync(process.execPath, [cli, "sync", "ios"], { stdio: "inherit" });
if (sync.status !== 0) process.exit(sync.status ?? 1);

// Capacitor run on Windows emits backslashes in Swift package path literals.
// Normalize the committed project so the same checkout resolves on macOS.
const packageFile = path.join("ios", "App", "CapApp-SPM", "Package.swift");
const packageText = await readFile(packageFile, "utf8");
await writeFile(packageFile, packageText.replaceAll("\\", "/"));

const assets = spawnSync(process.execPath, [path.join("scripts", "generate-mobile-assets.mjs")], { stdio: "inherit" });
process.exit(assets.status ?? 1);
