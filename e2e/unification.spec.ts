import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { createInitialGameState, reduceGameAction } from "../src/lib/euchre";
import type { E2eFixture } from "./global-setup";

test.describe.configure({ mode: "serial" });

let fixture: E2eFixture;

test.beforeAll(async () => {
  const fixturePath = process.env.EUCHRE_E2E_FIXTURE_PATH;
  if (!fixturePath) throw new Error("EUCHRE_E2E_FIXTURE_PATH is required");
  fixture = JSON.parse(await readFile(fixturePath, "utf8")) as E2eFixture;
});

test("Practice preserves setup, legal action, and presentation visibility boundaries", async ({ page }) => {
  const errors = watchForBrowserErrors(page);
  let firstPracticePayload: string | undefined;
  page.on("response", async (response) => {
    if (firstPracticePayload || response.request().method() !== "POST" || !response.url().includes("/practice")) return;
    try {
      firstPracticePayload = await response.text();
    } catch {
      // Non-JSON responses are covered by page and console error assertions.
    }
  });

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Practice table" })).toBeVisible();
  await page.getByLabel("Target").selectOption("5");
  await page.getByLabel("Bot difficulty").selectOption("standard");
  await page.getByLabel("Seed").fill("12345");
  await page.getByRole("button", { name: "Start hand" }).click();
  await expect(page.getByTestId("practice-table")).toBeVisible();
  await expect.poll(() => firstPracticePayload !== undefined).toBe(true);

  const actionable = page.locator([
    'button[aria-label^="Play "]:not([disabled])',
    'button[aria-label^="Discard "]:not([disabled])',
    'button:has-text("Pass"):not([disabled])',
    'button:has-text("Order up"):not([disabled])',
    'button:has-text("Call"):not([disabled])'
  ].join(","));
  await expect.poll(async () => actionable.count(), { timeout: 15_000 }).toBeGreaterThan(0);

  const cards = page.locator('[data-testid^="viewer-card-"]');
  await expect.poll(async () => cards.count()).toBeGreaterThanOrEqual(5);
  for (let index = 0; index < await cards.count(); index += 1) {
    const card = cards.nth(index);
    if (await card.getAttribute("data-legal") === "false") await expect(card).toBeDisabled();
  }

  const html = await page.content();
  const storage = await page.evaluate(() => JSON.stringify({ ...window.localStorage }));
  const initialState = reduceGameAction(createInitialGameState({
    targetScore: 5,
    botDifficulty: "standard"
  }), { type: "START_HAND", seed: 12345 });
  const publicUpcard = initialState?.upcard ? cardId(initialState.upcard) : undefined;
  const opponentIds = [1, 2, 3].flatMap((seat) => initialState.hands[seat as 1 | 2 | 3].map(cardId));
  const hiddenKittyIds = initialState.kitty.map(cardId).filter((id) => id !== publicUpcard);
  for (const id of [...opponentIds, ...hiddenKittyIds]) {
    expect(html).not.toContain(id);
    expect(storage).not.toContain(id);
    expect(firstPracticePayload).not.toContain(id);
  }
  expect(storage).not.toContain("hands");
  expect(storage).not.toContain("kitty");

  const moveLog = page.getByTestId("practice-move-log").getByRole("listitem");
  const beforeMoves = await moveLog.count();
  await actionable.first().click();
  await expect.poll(async () => moveLog.count()).toBeGreaterThan(beforeMoves);
  errors.assertNone();
});

test("native replay supports direct navigation, stepping, jump, and final truth", async ({ page }) => {
  const errors = watchForBrowserErrors(page);
  const response = await page.goto(`/club/replay/${fixture.completeGameId}?step=0`);
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId("replay-viewer")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(`Step 1 of ${fixture.totalReplaySteps}`);

  const earlyHtml = await page.content();
  for (const id of [...fixture.opponentCardIds, ...fixture.hiddenKittyCardIds]) expect(earlyHtml).not.toContain(id);
  expect(earlyHtml).not.toContain("78431");

  await page.getByRole("button", { name: "Next event" }).click();
  await expect(page.getByRole("status")).toHaveText(`Step 2 of ${fixture.totalReplaySteps}`);
  await expect(page).toHaveURL(new RegExp("step=1$"));
  await page.getByRole("button", { name: "Previous event" }).click();
  await expect(page.getByRole("status")).toHaveText(`Step 1 of ${fixture.totalReplaySteps}`);

  const slider = page.getByLabel("Replay timeline position");
  await slider.focus();
  await slider.press("End");
  await expect(page).toHaveURL(new RegExp(`step=${fixture.finalStepIndex}$`));
  await expect(page.getByTestId("replay-final-result")).toContainText(`Team 0 ${fixture.finalScore[0]}, Team 1 ${fixture.finalScore[1]}`);
  errors.assertNone();
});

test("replay hides the dealer discard and renders empty, unavailable, and missing states honestly", async ({ page }) => {
  if (fixture.discardStepIndex >= 0) {
    await page.goto(`/club/replay/${fixture.completeGameId}?step=${fixture.discardStepIndex}`);
    await expect(page.getByRole("heading", { name: /discarded/ })).toBeVisible();
    expect(await page.content()).not.toContain(fixture.hiddenDiscardCardId);
  }

  await page.goto(`/club/replay/${fixture.emptyGameId}`);
  await expect(page.getByRole("heading", { name: "No replayable events" })).toBeVisible();
  await page.goto(`/club/replay/${fixture.activeGameId}`);
  await expect(page.getByRole("heading", { name: "Replay unavailable" })).toBeVisible();
  await page.goto("/club/replay/game-does-not-exist");
  await expect(page.getByTestId("replay-not-found")).toBeVisible();
});

test("profile detail uses persisted fields and resolves native replay links", async ({ page }) => {
  const response = await page.goto("/club/profile/local-seat-0");
  expect(response?.status()).toBe(200);
  const main = page.getByTestId("profile-detail");
  await expect(main).toBeVisible();
  await expect(main.getByText("Local unauthenticated profile", { exact: false })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Completed games" })).toBeVisible();
  await expect(main.getByText(/^Rating$/i)).toHaveCount(0);
  await expect(main.getByText(/^Leaderboard$/i)).toHaveCount(0);
  await expect(main.getByText(/^Tournament/i)).toHaveCount(0);
  const replay = main.getByRole("link", { name: "Replay" }).first();
  await expect(replay).toHaveAttribute("href", `/club/replay/${fixture.completeGameId}`);
  await replay.click();
  await expect(page.getByTestId("replay-viewer")).toBeVisible();

  await page.goto("/club/profile/unknown-profile");
  await expect(page.getByTestId("profile-not-found")).toBeVisible();
});

test("desktop and mobile routes avoid document overflow and keep controls operable", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const route of ["/", "/club/profile/local-seat-0", `/club/replay/${fixture.completeGameId}?step=0`]) {
      await page.goto(route);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
    await expect(page.getByRole("button", { name: "Next event" })).toBeEnabled();
  }
});

function watchForBrowserErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location().url;
      consoleErrors.push(location ? `${message.text()} (${location})` : message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  return {
    assertNone() {
      expect(consoleErrors, `Console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
      expect(pageErrors, `Page errors: ${pageErrors.join(" | ")}`).toEqual([]);
      expect(failedResponses, `Failed responses: ${failedResponses.join(" | ")}`).toEqual([]);
    }
  };
}

function cardId(card: { rank: string; suit: string }): string {
  return `${card.rank}-${card.suit}`;
}
