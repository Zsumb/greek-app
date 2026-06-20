import { test, expect } from "@playwright/test";

/**
 * Time-machine interactions — preset highlight, custom scenario validation,
 * auto-reset on preset switch.
 *
 * Covers matrix items: J4, J5, J6, J7, K6
 */

test.describe("Time Machine", () => {
  test("J5: clicking a scenario preset highlights it (maroon = bg-primary)", async ({ page }) => {
    await page.goto("/");
    const btn = page.getByRole("button", { name: "Tomorrow flat" });
    await btn.click();
    // Active scenario button switches from variant="outline" to variant="default"
    // which gives it bg-primary (Tailwind class). The class string contains it.
    await expect(btn).toHaveClass(/bg-primary/, { timeout: 5_000 });
  });

  test("J4: scenario preset produces a non-zero Scenario P&L", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Tomorrow +2%" }).click();
    // Headline value uses font-mono text-3xl; it should not read $0.00
    const headline = page.locator(".font-mono.text-3xl").first();
    await expect(headline).toBeVisible({ timeout: 10_000 });
    await expect(headline).not.toContainText("$0.00", { timeout: 10_000 });
  });

  test("J6: custom scenario dialog validates out-of-range input", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Custom scenario" }).click();
    // Dialog open — its title is "Custom scenario"
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    // The dialog has 3 number inputs; Spot shock is the 2nd one
    const inputs = page.getByRole("dialog").locator('input[type="number"]');
    await inputs.nth(1).fill("9999"); // Spot shock way out of range
    // Error text should appear (e.g. "Must be ≤ 100.00")
    await expect(page.getByText(/Must be ≤/)).toBeVisible({ timeout: 5_000 });
    // Apply button disabled
    await expect(page.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  test("J7: switching strategy preset auto-resets shocks", async ({ page }) => {
    await page.goto("/");
    // Apply non-zero scenario
    await page.getByRole("button", { name: "Tomorrow +2%" }).click();
    const headline = page.locator(".font-mono.text-3xl").first();
    await expect(headline).not.toContainText("$0.00", { timeout: 10_000 });

    // Switch preset via the combobox
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Iron Condor" }).click();

    // Scenario P&L resets to $0.00 because the store zeroed all shocks
    await expect(headline).toContainText("$0.00", { timeout: 10_000 });
  });

  test("K6: extreme spot shock triggers residual warning", async ({ page }) => {
    await page.goto("/");
    // Open Custom scenario, set spot shock to the slider max (~$100)
    await page.getByRole("button", { name: "Custom scenario" }).click();
    const inputs = page.getByRole("dialog").locator('input[type="number"]');
    await inputs.nth(1).fill("100");
    await page.getByRole("button", { name: "Apply" }).click();
    // Amber "Heads up" residual warning appears
    await expect(page.getByText(/Heads up/i)).toBeVisible({ timeout: 10_000 });
  });
});
