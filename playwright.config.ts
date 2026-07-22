import path from "node:path";
import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:3005";
const storePath = path.resolve(".data", "e2e-event-store.json");
const fixturePath = path.resolve(".data", "e2e-fixture.json");

process.env.EUCHRE_LOCAL_EVENT_STORE_PATH = storePath;
process.env.EUCHRE_E2E_FIXTURE_PATH = fixturePath;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: ".data/playwright-report", open: "never" }]],
  outputDir: ".data/playwright-results",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL,
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "npm run start:e2e",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      EUCHRE_LOCAL_EVENT_STORE_PATH: storePath
    }
  }
});
