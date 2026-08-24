import { defineConfig } from "@playwright/test";

const defaultBaseUrl = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}/`
  : "http://localhost:26044/";

export default defineConfig({
  testDir: "./artifacts/smart360/e2e",
  outputDir: "./artifacts/smart360/test-results",
  timeout: 45_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL:
      process.env.SMART360_E2E_URL ?? defaultBaseUrl,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
    trace: "retain-on-failure",
  },
  reporter: [["list"]],
});