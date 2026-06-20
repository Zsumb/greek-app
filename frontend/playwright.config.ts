import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config.
 *
 * Assumes BOTH backend (port 8000) and frontend (port 3000) are already
 * running locally. We don't have Playwright spawn the dev server itself
 * because Next 16 + Turbopack takes 10-15s to warm up — it's faster to
 * keep the dev server running in a separate shell during iteration.
 *
 * To run:
 *   1. Start backend:  cd backend && python -m uvicorn app.main:app --reload
 *   2. Start frontend: cd frontend && npm run dev
 *   3. Run tests:      cd frontend && npm run e2e
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
