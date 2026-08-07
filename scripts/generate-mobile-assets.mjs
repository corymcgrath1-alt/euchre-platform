import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "resources", "mobile", "app-icon-source.png");
const assetCatalog = path.join(root, "ios", "App", "App", "Assets.xcassets");
const icon = path.join(assetCatalog, "AppIcon.appiconset", "AppIcon-512@2x.png");
const splashDirectory = path.join(assetCatalog, "Splash.imageset");
const splash = path.join(splashDirectory, "splash-2732x2732.png");

await mkdir(path.dirname(icon), { recursive: true });
await mkdir(splashDirectory, { recursive: true });

await sharp(source)
  .resize(1024, 1024, { fit: "cover" })
  .flatten({ background: "#071411" })
  .png()
  .toFile(icon);

const centeredIcon = await sharp(source)
  .resize(1040, 1040, { fit: "contain" })
  .flatten({ background: "#071411" })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: 2732,
    height: 2732,
    channels: 3,
    background: "#071411"
  }
})
  .composite([{ input: centeredIcon, gravity: "center" }])
  .png()
  .toFile(splash);

await Promise.all([
  cp(splash, path.join(splashDirectory, "splash-2732x2732-1.png")),
  cp(splash, path.join(splashDirectory, "splash-2732x2732-2.png"))
]);

console.log("Generated opaque 1024px app icon and 2732px launch assets.");
