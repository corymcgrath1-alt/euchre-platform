import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import release from "../mobile.release.json" with { type: "json" };

const root = process.cwd();
const read = (relativePath, encoding = "utf8") => readFile(path.join(root, relativePath), encoding);
const [capacitor, info, privacy, project, workspace, packageSwift, icon] = await Promise.all([
  read("capacitor.config.ts"),
  read("ios/App/App/Info.plist"),
  read("ios/App/App/PrivacyInfo.xcprivacy"),
  read("ios/App/App.xcodeproj/project.pbxproj"),
  read("ios/App/App.xcworkspace/contents.xcworkspacedata"),
  read("ios/App/CapApp-SPM/Package.swift"),
  read("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", null)
]);

const failures = [];
const requireText = (text, pattern, message) => {
  if (!pattern.test(text)) failures.push(message);
};
const forbidText = (text, pattern, message) => {
  if (pattern.test(text)) failures.push(message);
};

for (const [label, value] of [
  ["privacy policy URL", release.privacyPolicyUrl],
  ["support URL", release.supportUrl],
  ["support request URL", release.supportRequestUrl]
]) {
  if (!value.startsWith("https://") || value.includes("example.invalid")) {
    failures.push(`Release ${label} must be a final HTTPS URL.`);
  }
}

forbidText(capacitor, /\bserver\s*:|server\.url/u, "Capacitor must load bundled assets without server.url.");
requireText(capacitor, /webDir:\s*"dist-mobile"/u, "Capacitor webDir must be dist-mobile.");
requireText(capacitor, /loggingBehavior:\s*"none"/u, "Native release logging must be disabled.");

requireText(info, /<string>Euchre Club<\/string>/u, "Info.plist display name must be Euchre Club.");
requireText(
  info,
  /<key>UISupportedInterfaceOrientations<\/key>[\s\S]*?<string>UIInterfaceOrientationPortrait<\/string>[\s\S]*?<\/array>/u,
  "Info.plist must support portrait orientation."
);
forbidText(info, /UIInterfaceOrientationLandscape|~ipad/u, "Version 1.0 must not advertise iPad or landscape support.");
forbidText(
  info,
  /NS(?:Location|Contacts|Camera|Microphone|Photo|Bluetooth|Motion|Health|LocalNetwork|UserTracking)[A-Za-z]*UsageDescription/u,
  "Info.plist contains an unnecessary protected-resource permission."
);
forbidText(info, /<key>UIBackgroundModes<\/key>/u, "Version 1.0 must not declare background modes.");
forbidText(info, /NSAllowsArbitraryLoads/u, "Info.plist must not contain an arbitrary ATS exception.");

requireText(privacy, /<key>NSPrivacyTracking<\/key>\s*<false\/>/u, "Privacy manifest must explicitly disable tracking.");
for (const key of ["NSPrivacyTrackingDomains", "NSPrivacyCollectedDataTypes", "NSPrivacyAccessedAPITypes"]) {
  requireText(privacy, new RegExp(`<key>${key}</key>\\s*<array\\s*/>`, "u"), `Privacy manifest ${key} must be an explicit empty array.`);
}
requireText(project, /PrivacyInfo\.xcprivacy in Resources/u, "PrivacyInfo.xcprivacy must belong to the app resources.");
requireText(project, /TARGETED_DEVICE_FAMILY = 1;/u, "The Xcode target must be iPhone-only.");
requireText(project, /IPHONEOS_DEPLOYMENT_TARGET = 15\.0;/u, "The iOS deployment target must remain 15.0.");
requireText(project, new RegExp(`PRODUCT_BUNDLE_IDENTIFIER = ${escapeRegExp(release.bundleIdentifier)};`, "u"), "Xcode bundle ID must match mobile.release.json.");
requireText(project, new RegExp(`MARKETING_VERSION = ${escapeRegExp(release.marketingVersion)};`, "u"), "Xcode marketing version must match mobile.release.json.");
requireText(project, new RegExp(`CURRENT_PROJECT_VERSION = ${escapeRegExp(release.buildNumber)};`, "u"), "Xcode build number must match mobile.release.json.");
requireText(workspace, /location\s*=\s*"group:App\.xcodeproj"/u, "Xcode workspace must reference App.xcodeproj.");

for (const dependency of [
  "@capacitor/app",
  "@capacitor/haptics",
  "@capacitor/share",
  "@capacitor/splash-screen",
  "@capacitor/status-bar"
]) {
  requireText(packageSwift, new RegExp(escapeRegExp(dependency), "u"), `Swift package manifest is missing ${dependency}.`);
}
forbidText(packageSwift, /CapacitorPreferences|@capacitor\/preferences/u, "Unused Capacitor Preferences must not be linked.");
forbidText(packageSwift, /\\\\/u, "Swift package paths must use portable forward slashes.");

const iconMetadata = readPngHeader(icon);
if (iconMetadata.width !== 1024 || iconMetadata.height !== 1024) {
  failures.push(`App Store icon must be 1024x1024; found ${iconMetadata.width}x${iconMetadata.height}.`);
}
if (iconMetadata.colorType !== 2) {
  failures.push(`App Store icon must be opaque RGB PNG (color type 2); found color type ${iconMetadata.colorType}.`);
}

if (failures.length) {
  console.error("iOS static configuration check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("iOS static configuration check passed:");
console.log(`- ${release.appName} ${release.marketingVersion} (${release.buildNumber})`);
console.log(`- bundle identifier: ${release.bundleIdentifier} (owner confirmation required: ${release.ownerConfirmationRequired})`);
console.log("- iPhone-only, portrait-only, bundled assets, no protected-resource permission strings");
console.log("- privacy manifest in app resources; tracking/data/required-reason arrays currently empty");
console.log("- 1024x1024 opaque RGB App Store icon");

function readPngHeader(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a" || buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("App icon is not a valid PNG with an IHDR header.");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer.readUInt8(25)
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
