import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

/** pnpm exec playwright test --config artifacts/smart360/e2e/playwright.offline.config.ts */
export default defineConfig({
  testDir: ".",
  testMatch: "offline-integration.spec.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  outputDir: "../reports/offline/test-results",
  reporter: [["list"], ["json", { outputFile: resolve(import.meta.dirname, "../reports/offline/results.json") }]],
  use: {
    baseURL: "http://127.0.0.1:4193",
    viewport: { width: 390, height: 844 },
    serviceWorkers: "allow",
    acceptDownloads: true,
    actionTimeout: 20_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
        "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "node --import tsx/esm e2e/offline-fixture-server.ts",
    cwd: "..",
    url: "http://127.0.0.1:4193/__fixture/health",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});