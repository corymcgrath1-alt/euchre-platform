import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, devices } from "@playwright/test";
import sharp from "sharp";
import { preview } from "vite";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(repositoryRoot, "resources", "app-store-screenshots", "6.9-inch");
await mkdir(outputDirectory, { recursive: true });

const previewServer = await preview({
  configFile: path.join(repositoryRoot, "vite.mobile.config.ts"),
  preview: { host: "127.0.0.1", port: 4176, strictPort: true }
});
const browser = await chromium.launch();

try {
  const context = await browser.newContext({
    ...devices["iPhone 15 Pro Max"],
    browserName: undefined,
    viewport: { width: 430, height: 932 },
    colorScheme: "dark"
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4176/");
  await page.getByRole("heading", { name: "Euchre Club" }).waitFor();

  await capture(page, "06-play-solo-anywhere.png");
  await page.getByRole("button", { name: "Play Solo" }).click();
  await page.getByRole("button", { name: /Advanced Settings/ }).click();
  await page.getByLabel("Target score").selectOption("5");
  await page.getByLabel("Bot difficulty").selectOption("standard");
  await page.getByLabel("First dealer").selectOption("human");
  await page.getByLabel("Practice seed").fill("918273");
  await page.getByTestId("advanced-settings").scrollIntoViewIfNeeded();
  await capture(page, "05-make-the-rules-yours.png");

  await page.getByRole("button", { name: "Deal Cards" }).click();
  await page.getByTestId("active-table").waitFor();
  await waitForHumanAction(page);
  await capture(page, "01-play-a-complete-hand.png");

  let capturedHandResult = false;
  let loneDeclared = false;
  for (let step = 0; step < 2_000; step += 1) {
    if (await page.getByTestId("game-result-screen").isVisible().catch(() => false)) break;
    if (await page.getByTestId("hand-result-screen").isVisible().catch(() => false)) {
      if (!capturedHandResult) {
        await capture(page, "02-see-every-hand-result.png");
        capturedHandResult = true;
      }
      await page.waitForTimeout(280);
      const continueButton = page.getByRole("button", { name: "Continue" });
      if (await continueButton.isVisible().catch(() => false) && await continueButton.isEnabled()) {
        await continueButton.click();
      }
      continue;
    }

    const alone = page.getByLabel("Go alone");
    if (!loneDeclared && await alone.isVisible().catch(() => false) && await alone.isEnabled()) {
      await alone.check();
      loneDeclared = true;
    }
    if (await clickFirstEnabled(page, [
      page.getByRole("button", { name: /^Order Up/ }),
      page.getByRole("button", { name: /^Call / }).first(),
      page.getByRole("button", { name: "Pass" }),
      page.getByRole("button", { name: "Keep Hand" }),
      page.getByRole("button", { name: "Redeal" }),
      page.getByRole("button", { name: /^Replace / }),
      page.locator('[data-testid="hand-card"]:not(:disabled)').first()
    ])) {
      await page.waitForTimeout(10);
      continue;
    }
    await page.waitForTimeout(20);
  }

  if (!capturedHandResult) throw new Error("No hand result was available for the App Store screenshot set.");
  if (!await page.getByTestId("game-result-screen").isVisible().catch(() => false)) {
    const screenText = (await page.locator("main").innerText().catch(() => "unknown screen")).slice(0, 500);
    throw new Error(`The deterministic screenshot game did not complete. Current screen: ${screenText}`);
  }
  await capture(page, "03-finish-every-game.png");
  await page.getByRole("button", { name: "Review Game" }).click();
  await page.getByTestId("review-screen").waitFor();
  await capture(page, "04-review-your-play.png");
  await context.close();
} finally {
  await browser.close();
  await previewServer.close();
}

async function capture(page, fileName) {
  const screenshot = await page.screenshot({ animations: "disabled", fullPage: false });
  const target = path.join(outputDirectory, fileName);
  await sharp(screenshot).removeAlpha().png().toFile(target);
  const metadata = await sharp(target).metadata();
  if (metadata.width !== 1290 || metadata.height !== 2796 || metadata.hasAlpha) {
    throw new Error(`${fileName} must be an opaque 1290x2796 PNG; found ${metadata.width}x${metadata.height}.`);
  }
  console.log(`Captured ${path.relative(repositoryRoot, target)} (${metadata.width}x${metadata.height}, opaque).`);
}

async function waitForHumanAction(page) {
  await page.waitForFunction(() => {
    return [...document.querySelectorAll('[data-testid="legal-actions"] button, [data-testid="hand-card"]')]
      .some((element) => !element.disabled);
  }, undefined, { timeout: 15_000 });
}

async function clickFirstEnabled(page, candidates) {
  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false) && await candidate.isEnabled().catch(() => false)) {
      await candidate.click();
      return true;
    }
  }
  return false;
}
