import { test, expect } from "@playwright/test";

/**
 * Chat widget + builder/preset/ticker interactions.
 *
 * Covers matrix items: J3, J8, J9, J10, K1, K4
 *
 * J10 (chat message round-trip) requires ANTHROPIC_API_KEY on the backend.
 * If absent, the test is skipped at runtime.
 */

test.describe("Builder", () => {
  test("J3: switching strategy preset changes Live Greeks values", async ({ page }) => {
    await page.goto("/playground");
    await expect(page.getByText("Live Greeks", { exact: true })).toBeVisible();

    // Capture the first font-mono number visible in the Greeks panel area
    const firstGreek = page.locator(".font-mono", { hasText: /^-?\$?\d/ }).first();
    await expect(firstGreek).toBeVisible({ timeout: 15_000 });
    const before = (await firstGreek.textContent())?.trim() ?? "";

    // Switch to Long Put
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Long Put" }).click();

    // After change, the first Greeks value should differ
    await expect(firstGreek).not.toHaveText(before, { timeout: 15_000 });
  });

  test("K4: editing Spot triggers refetch but does NOT reset shocks", async ({ page }) => {
    await page.goto("/playground");
    // Apply a non-zero scenario
    await page.getByRole("button", { name: "Tomorrow +2%" }).click();
    const headline = page.locator(".font-mono.text-3xl").first();
    await expect(headline).not.toContainText("$0.00", { timeout: 10_000 });
    const before = (await headline.textContent())?.trim() ?? "";

    // Find the Spot input by its label
    const spotInput = page.locator("input[type='number']").first();
    await spotInput.fill("520");
    await spotInput.blur();

    // Shocks stay applied; headline P&L stays non-zero, just different
    await expect(headline).not.toContainText("$0.00", { timeout: 10_000 });
    await expect(headline).not.toHaveText(before, { timeout: 10_000 });
  });
});

test.describe("Chat", () => {
  test("J9: chat widget opens and closes", async ({ page }) => {
    await page.goto("/playground");
    const launcher = page.getByRole("button", { name: "Open chat" });
    await launcher.click();
    await expect(page.getByText("Ask about your position")).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: "Close chat" }).click();
    await expect(page.getByText("Ask about your position")).not.toBeVisible();
  });

  test("J10: sending a chat message renders an assistant reply", async ({ page, request }) => {
    // Skip if backend doesn't have ANTHROPIC_API_KEY
    const probe = await request.post("http://127.0.0.1:8000/chat", {
      data: {
        messages: [{ role: "user", content: "ping" }],
        position: {
          S: 500, sigma: 0.2, r: 0.05,
          legs: [{ kind: "call", strike: 500, expiry_days: 30, quantity: 1 }],
        },
      },
      timeout: 15_000,
      failOnStatusCode: false,
    });
    if (probe.status() === 503) {
      test.skip(true, "ANTHROPIC_API_KEY not set on backend");
    }

    await page.goto("/playground");
    await page.getByRole("button", { name: "Open chat" }).click();

    const textarea = page.getByPlaceholder(/Ask anything/);
    await textarea.fill("In one sentence, what is delta?");
    await page.getByRole("button", { name: "Send" }).click();

    // Wait until "Thinking…" disappears (response arrived)
    await expect(page.getByText("Thinking…")).toBeHidden({ timeout: 60_000 });
    // An assistant bubble (zinc background) appears
    await expect(page.locator(".bg-zinc-100, .bg-zinc-800").first())
      .toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Ticker", () => {
  test("J8: ticker fetch autofills Spot/IV (live yfinance)", async ({ page }) => {
    await page.goto("/playground");
    const tickerInput = page.getByPlaceholder(/e\.g\. SPY/);
    await tickerInput.fill("SPY");
    await page.getByRole("button", { name: /Fetch/ }).click();

    // After fetch, the SPY badge appears (use exact text in case body contains
    // the substring elsewhere)
    await expect(
      page.locator("span", { hasText: /^SPY$/ }).first()
    ).toBeVisible({ timeout: 30_000 });
    // And the helper sentence mentions real expiries
    await expect(page.getByText(/leg DTE field now uses real expiries/i))
      .toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Error handling", () => {
  test("K1: backend unreachable surfaces inline error", async ({ page }) => {
    // Intercept all backend calls (both local + production hostnames)
    await page.route("**/*/position/greeks", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: '{"detail":"down"}' }),
    );
    await page.goto("/playground");
    await expect(page.getByText(/Couldn.t compute Greeks/i))
      .toBeVisible({ timeout: 15_000 });
  });
});
