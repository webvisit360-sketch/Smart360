import { defineConfig } from "@playwright/test";

const executablePath = process.env.CHROMIUM_PATH;

export default defineConfig({
  use: {
    baseURL: "http://127.0.0.1:4179",
    viewport: { width: 1100, height: 1000 },
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  workers: 1,
});