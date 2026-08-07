import { spawnSync } from "node:child_process";
import process from "node:process";
import release from "../mobile.release.json" with { type: "json" };

const missing = [];
if (process.platform !== "darwin") missing.push("macOS with Xcode 26 or newer");
if (!process.env.APPLE_TEAM_ID?.trim()) missing.push("APPLE_TEAM_ID");
if (!process.env.IOS_SIGNING_IDENTITY?.trim()) missing.push("IOS_SIGNING_IDENTITY");
if (!process.env.IOS_PROVISIONING_PROFILE_SPECIFIER?.trim()) {
  missing.push("IOS_PROVISIONING_PROFILE_SPECIFIER");
}
if (release.ownerConfirmationRequired) missing.push("owner confirmation in mobile.release.json");
const privacyPolicyUrl = process.env.VITE_PRIVACY_POLICY_URL?.trim() || release.privacyPolicyUrl;
const supportUrl = process.env.VITE_SUPPORT_URL?.trim() || release.supportUrl;
if (!privacyPolicyUrl?.startsWith("https://") || privacyPolicyUrl.includes("example.invalid")) {
  missing.push("final VITE_PRIVACY_POLICY_URL");
}
if (!supportUrl?.startsWith("https://") || supportUrl.includes("example.invalid")) {
  missing.push("final VITE_SUPPORT_URL");
}

if (missing.length) {
  console.error("iOS archive check cannot run. Missing:");
  missing.forEach((item) => console.error(`- ${item}`));
  console.error("No archive was created and nothing was uploaded.");
  process.exit(1);
}

const version = spawnSync("xcodebuild", ["-version"], { encoding: "utf8" });
if (version.status !== 0) {
  console.error("xcodebuild is unavailable. No archive was created and nothing was uploaded.");
  process.exit(1);
}
const match = /^Xcode\s+(\d+)/mu.exec(version.stdout);
if (!match || Number(match[1]) < 26) {
  console.error(`Xcode 26 or newer is required. Detected: ${version.stdout.trim() || "unknown"}`);
  console.error("No archive was created and nothing was uploaded.");
  process.exit(1);
}
console.log(version.stdout.trim());

const result = spawnSync("xcodebuild", [
  "-workspace", "ios/App/App.xcworkspace",
  "-scheme", "App",
  "-configuration", "Release",
  "-destination", "generic/platform=iOS",
  "-archivePath", "build/EuchreClub.xcarchive",
  `DEVELOPMENT_TEAM=${process.env.APPLE_TEAM_ID}`,
  `CODE_SIGN_IDENTITY=${process.env.IOS_SIGNING_IDENTITY}`,
  `PROVISIONING_PROFILE_SPECIFIER=${process.env.IOS_PROVISIONING_PROFILE_SPECIFIER}`,
  "CODE_SIGN_STYLE=Manual",
  `PRODUCT_BUNDLE_IDENTIFIER=${release.bundleIdentifier}`,
  "archive"
], { stdio: "inherit" });

process.exit(result.status ?? 1);
