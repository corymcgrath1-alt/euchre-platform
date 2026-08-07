import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./mobile/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 12_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report/mobile", open: "never" }]],
  outputDir: "test-results/mobile",
  use: {
    baseURL: "http://127.0.0.1:4176",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    hasTouch: true,
    isMobile: true
  },
  projects: [
    {
      name: "iphone-320",
      use: { ...devices["iPhone SE"], browserName: "chromium", viewport: { width: 320, height: 667 } }
    },
    {
      name: "iphone-390",
      use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } }
    },
    {
      name: "iphone-430",
      use: { ...devices["iPhone 15 Pro Max"], browserName: "chromium", viewport: { width: 430, height: 932 } }
    }
  ]
});
