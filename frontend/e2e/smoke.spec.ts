import { test, expect } from "@playwright/test";

/**
 * Smoke tests — the page loads and the default position renders Greeks
 * end-to-end (frontend → backend → render).
 *
 * Covers matrix items: J1, J2, K3
 */

test.describe("Smoke", () => {
  test("J1: page loads with key headings", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Options Greeks Playground");
    await expect(page.getByText("Strategy Builder")).toBeVisible();
    await expect(page.getByText("Live Greeks")).toBeVisible();
    await expect(page.getByText("Time Machine")).toBeVisible();
  });

  test("J2: default position populates Live Greeks", async ({ page }) => {
    await page.goto("/");
    // Live Greeks card title
    await expect(page.getByText("Live Greeks", { exact: true })).toBeVisible();
    // After TanStack Query resolves, the Delta value should be in the document
    // as a font-mono number — search by its expected pattern (54.00 ± a bit)
    await expect(
      page.locator(".font-mono", { hasText: /^5[34]\.\d{2}$/ }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("K3: iron condor round-trip — builder → Greeks → payoff", async ({ page }) => {
    await page.goto("/");
    // Wait for initial render to settle
    await expect(page.getByText("Live Greeks", { exact: true })).toBeVisible();

    // Preset Select is a combobox; click its trigger by its visible value
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Iron Condor" }).click();

    // After preset change, Iron Condor's Greeks: positive theta (green emerald)
    // Wait for refetch; look for any emerald-tone Theta value in the Live Greeks area
    await expect(
      page.locator(".text-emerald-700", { hasText: /^\$\d/ }).first()
    ).toBeVisible({ timeout: 15_000 });

    // Payoff card label flips to "Net credit" for credit-receiving iron condor
    await expect(page.getByText("Net credit")).toBeVisible({ timeout: 15_000 });
  });
});
