import { spawnSync } from "node:child_process";
import process from "node:process";

if (process.platform !== "darwin") {
  console.error("iOS simulator builds require macOS with Xcode 26 or newer.");
  process.exit(1);
}

const version = spawnSync("xcodebuild", ["-version"], { encoding: "utf8" });
if (version.status !== 0) {
  console.error("xcodebuild is unavailable. Install and select Xcode 26 or newer.");
  process.exit(1);
}
const match = /^Xcode\s+(\d+)/mu.exec(version.stdout);
if (!match || Number(match[1]) < 26) {
  console.error(`Xcode 26 or newer is required. Detected: ${version.stdout.trim() || "unknown"}`);
  process.exit(1);
}
console.log(version.stdout.trim());

const result = spawnSync("xcodebuild", [
  "-workspace", "ios/App/App.xcworkspace",
  "-scheme", "App",
  "-configuration", "Debug",
  "-sdk", "iphonesimulator",
  "-destination", "generic/platform=iOS Simulator",
  "CODE_SIGNING_ALLOWED=NO",
  "build"
], { stdio: "inherit" });

process.exit(result.status ?? 1);
