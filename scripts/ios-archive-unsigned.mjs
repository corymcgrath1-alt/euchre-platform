import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

if (process.platform !== "darwin") {
  console.error("Unsigned iOS archive checks require macOS with Xcode 26 or newer.");
  process.exit(1);
}

const version = spawnSync("xcodebuild", ["-version"], { encoding: "utf8" });
const match = /^Xcode\s+(\d+)/mu.exec(version.stdout ?? "");
if (version.status !== 0 || !match || Number(match[1]) < 26) {
  console.error(`Xcode 26 or newer is required. Detected: ${version.stdout?.trim() || "unavailable"}`);
  process.exit(1);
}
console.log(version.stdout.trim());

const archivePath = path.resolve("ios", "App", "build", "EuchreClub-unsigned.xcarchive");
const result = spawnSync("xcodebuild", [
  "-workspace", "ios/App/App.xcworkspace",
  "-scheme", "App",
  "-configuration", "Release",
  "-destination", "generic/platform=iOS",
  "-archivePath", archivePath,
  "CODE_SIGNING_ALLOWED=NO",
  "CODE_SIGNING_REQUIRED=NO",
  "archive"
], { stdio: "inherit" });

if (result.status !== 0) process.exit(result.status ?? 1);

const appBundle = path.join(archivePath, "Products", "Applications", "App.app");
for (const requiredPath of [
  path.join(archivePath, "Info.plist"),
  path.join(appBundle, "Info.plist"),
  path.join(appBundle, "PrivacyInfo.xcprivacy"),
  path.join(appBundle, "public", "index.html")
]) {
  await access(requiredPath);
}

console.log(`Unsigned Release archive passed: ${archivePath}`);
console.log("Verified app bundle, Info.plist, PrivacyInfo.xcprivacy, and bundled public/index.html.");
