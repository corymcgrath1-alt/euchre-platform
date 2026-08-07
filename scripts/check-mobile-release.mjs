import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dist = path.join(root, "dist-mobile");
const sourceFiles = await walk(path.join(root, "mobile", "src"));
const distFiles = await walk(dist);
const capacitorConfig = await readFile(path.join(root, "capacitor.config.ts"), "utf8");
const sourceText = (await Promise.all(sourceFiles.map((file) => readFile(file, "utf8")))).join("\n");
const distText = (await Promise.all(distFiles
  .filter((file) => /\.(?:html|js|css|json)$/u.test(file))
  .map((file) => readFile(file, "utf8")))).join("\n");

const failures = [];

if (/\bserver\s*:/u.test(capacitorConfig) || /server\.url/u.test(capacitorConfig)) {
  failures.push("Capacitor config contains a server block; release assets must be bundled.");
}

for (const [label, pattern] of [
  ["server persistence", /local-event-store|supabase-event-store|@supabase\/supabase-js/u],
  ["Next.js runtime", /(?:from|import\()\s*["']next(?:\/|["'])/u],
  ["Next.js API calls", /["'`]\/api\//u],
  ["development logging", /\bconsole\.(?:log|debug|trace)\b/u],
  ["mock multiplayer", /fake queue|mock player|matchmaking timer/iu]
]) {
  if (pattern.test(sourceText)) failures.push(`Mobile source contains ${label}.`);
}

for (const [label, pattern] of [
  ["localhost", /localhost/iu],
  ["loopback address", /127\.0\.0\.1/iu],
  ["Capacitor live reload", /livereload|live-reload|server\.url/iu],
  ["mock multiplayer", /fake queue|mock player|matchmaking timer/iu]
]) {
  if (pattern.test(distText)) failures.push(`Mobile release bundle contains ${label}.`);
}

const hasPlaceholders = /example\.invalid/iu.test(distText);
const hasVisibleWarning = /data-release-placeholder-warning/iu.test(distText)
  && /owner action required|release warning/iu.test(distText);
if (hasPlaceholders && !hasVisibleWarning) {
  failures.push("Release placeholders are present without a visible owner warning.");
}

if (!distFiles.some((file) => file.endsWith("index.html"))) {
  failures.push("dist-mobile/index.html is missing; run mobile:build first.");
}

if (failures.length) {
  console.error("Mobile release safeguard failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Mobile release safeguard passed (${sourceFiles.length} source files, ${distFiles.length} bundled files).`);
if (hasPlaceholders) {
  console.log("Owner warning: privacy/support placeholder values remain and must be replaced before App Review.");
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}
