import { execFileSync } from "node:child_process";
import { defineConfig } from "@playwright/test";

execFileSync(process.execPath, ["scripts/run-e2e.mjs", "check"], { stdio: "inherit" });

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3017",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    reducedMotion: "reduce",
  },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    { command: "node scripts/run-e2e.mjs start", url: "http://127.0.0.1:3017", reuseExistingServer: false, timeout: 120_000 },
    { command: "node scripts/run-e2e.mjs start-payments", url: "http://127.0.0.1:3018", reuseExistingServer: false, timeout: 120_000 },
  ],
});
