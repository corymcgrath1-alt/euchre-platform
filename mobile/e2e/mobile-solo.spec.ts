import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("home and active play fit supported iPhone widths without runtime errors", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await expect(page.getByRole("heading", { name: "Euchre Club" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play Solo" })).toBeVisible();
  await assertNoHorizontalOverflow(page);

  await startGame(page, { seed: 31001, animation: "none" });
  await expect(page.getByTestId("active-table")).toBeVisible();
  await expect(page.getByRole("region", { name: "Your hand" })).toBeVisible();
  const cardCount = await page.getByTestId("hand-card").count();
  expect(cardCount).toBeGreaterThanOrEqual(5);
  expect(cardCount).toBeLessThanOrEqual(6);
  await assertNoHorizontalOverflow(page);
  await assertEssentialControlsInViewport(page);

  const ownCards = await page.getByTestId("hand-card").evaluateAll((buttons) => (
    buttons.map((button) => button.getAttribute("aria-label"))
  ));
  expect(ownCards.every((label) => typeof label === "string" && label.length > 3)).toBe(true);
  expect(await page.locator(".seat:not(.seat--south) .playing-card").count()).toBe(0);
  expect(errors).toEqual([]);
});

test("a human action, reload, and app lifecycle resume preserve one authoritative game", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "Lifecycle scenario runs once at the primary phone size.");
  const errors = collectRuntimeErrors(page);
  await startGame(page, { seed: 73421, animation: "reduced" });
  await waitForHumanAction(page);

  const handBefore = await page.getByTestId("hand-card").evaluateAll((buttons) => (
    buttons.map((button) => button.getAttribute("aria-label"))
  ));
  const handHeading = await page.getByRole("heading", { name: /^Hand \d+$/ }).textContent();
  await page.getByRole("button", { name: "Go back" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Resume Game" }).click();
  await expect(page.getByTestId("active-table")).toBeVisible();
  expect(await page.getByTestId("hand-card").evaluateAll((buttons) => (
    buttons.map((button) => button.getAttribute("aria-label"))
  ))).toEqual(handBefore);
  await expect(page.getByRole("heading", { name: handHeading ?? "Hand" })).toBeVisible();

  const countBefore = await eventCount(page);
  await submitActionThatYieldsTurn(page);
  await setDocumentHidden(page, true);
  await expect.poll(() => eventCount(page)).toBeGreaterThan(countBefore);
  const countAfterHuman = await eventCount(page);
  await page.waitForTimeout(500);
  expect(await eventCount(page)).toBe(countAfterHuman);

  await setDocumentHidden(page, false);
  await expect.poll(() => eventCount(page), { timeout: 8_000 }).toBeGreaterThan(countAfterHuman);
  expect(errors).toEqual([]);
});

test("a complete short game works offline and opens local review", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "Full deterministic game runs once at the primary phone size.");
  const errors = collectRuntimeErrors(page);
  await startGame(page, { seed: 918273, animation: "none", autoDeal: true, targetScore: 5 });
  await context.setOffline(true);
  const coreGameplayRequests: string[] = [];
  page.on("request", (request) => coreGameplayRequests.push(request.url()));

  const loneDeclared = await completeGame(page);
  expect(loneDeclared).toBe(true);
  const result = page.getByTestId("game-result-screen");
  await expect(result).toBeVisible();
  await expect(page.getByTestId("share-result")).toBeEnabled();
  const finalScore = await result.getByRole("heading", { level: 2 }).textContent();
  expect(finalScore).toMatch(/^\d+ - \d+$/);

  await page.getByRole("button", { name: "Review Game" }).click();
  await expect(page.getByTestId("review-screen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Game Review" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bidding" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tricks" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  expect(coreGameplayRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("reduced motion and reset confirmation are exposed accessibly", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-390", "Settings scenario runs once at the primary phone size.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Animation level").selectOption("reduced");
  await expect(page.getByLabel("Animation level")).toHaveValue("reduced");
  await page.getByRole("button", { name: "Home" }).click();
  await page.getByRole("button", { name: "Play Solo" }).click();
  await page.getByRole("button", { name: "Deal Cards" }).click();
  await expect(page.getByTestId("active-table")).toHaveClass(/animation-reduced/u);
  await page.getByRole("button", { name: "Go back" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Reset Local Data" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Reset all local data?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Reset Everything" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

async function startGame(
  page: Page,
  options: {
    seed: number;
    animation: "full" | "reduced" | "none";
    autoDeal?: boolean;
    targetScore?: number;
  }
): Promise<void> {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Animation level").selectOption(options.animation);
  if (options.autoDeal) await page.getByLabel("Auto-deal next hand").check();
  await page.getByRole("button", { name: "Home" }).click();
  await page.getByRole("button", { name: "Play Solo" }).click();
  await page.getByLabel("Target score").selectOption(String(options.targetScore ?? 5));
  await page.getByLabel("Bot difficulty").selectOption("easy");
  await page.getByRole("button", { name: /Advanced Settings/ }).click();
  await page.getByLabel("Practice seed").fill(String(options.seed));
  await page.getByRole("button", { name: "Deal Cards" }).click();
  await expect(page.getByTestId("active-table")).toBeVisible();
}

async function completeGame(page: Page): Promise<boolean> {
  let loneDeclared = false;
  for (let step = 0; step < 1_000; step += 1) {
    if (await page.getByTestId("game-result-screen").isVisible().catch(() => false)) return loneDeclared;
    if (await page.getByTestId("hand-result-screen").isVisible().catch(() => false)) {
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
      await page.waitForTimeout(8);
      continue;
    }
    await page.waitForTimeout(15);
  }
  throw new Error("Deterministic mobile game did not complete within 1,000 interaction steps.");
}

async function waitForHumanAction(page: Page): Promise<void> {
  await expect.poll(async () => {
    return page.getByTestId("legal-actions").getByRole("button").evaluateAll((buttons) => (
      buttons.some((button) => !(button as HTMLButtonElement).disabled)
    )).catch(() => false)
      || page.getByTestId("hand-card").evaluateAll((buttons) => (
        buttons.some((button) => !(button as HTMLButtonElement).disabled)
      )).catch(() => false);
  }, { timeout: 15_000 }).toBe(true);
}

async function submitActionThatYieldsTurn(page: Page): Promise<void> {
  const pass = page.getByRole("button", { name: "Pass" });
  if (await pass.isVisible().catch(() => false) && await pass.isEnabled()) {
    await pass.click();
    return;
  }
  const bid = page.getByRole("button", { name: /^Order Up|^Call / }).first();
  if (await bid.isVisible().catch(() => false) && await bid.isEnabled()) {
    await bid.click();
    return;
  }
  const card = page.locator('[data-testid="hand-card"]:not(:disabled)').first();
  await expect(card).toBeVisible();
  await card.click();
}

async function clickFirstEnabled(page: Page, candidates: ReturnType<Page["locator"]>[]): Promise<boolean> {
  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false) && await candidate.isEnabled().catch(() => false)) {
      await candidate.click();
      return true;
    }
  }
  return false;
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function assertEssentialControlsInViewport(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Viewport is unavailable.");
  const hand = await page.getByRole("region", { name: "Your hand" }).boundingBox();
  expect(hand).not.toBeNull();
  expect(hand!.x).toBeGreaterThanOrEqual(0);
  expect(hand!.x + hand!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(hand!.y + hand!.height).toBeLessThanOrEqual(viewport.height + 1);
}


async function eventCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    return new Promise<number>((resolve, reject) => {
      const request = indexedDB.open("euchre-club-offline-v1");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("events", "readonly");
        const count = transaction.objectStore("events").count();
        count.onsuccess = () => {
          db.close();
          resolve(count.result);
        };
        count.onerror = () => reject(count.error);
      };
    });
  });
}

async function setDocumentHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((nextHidden) => {
    Object.defineProperty(document, "hidden", { configurable: true, value: nextHidden });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}
