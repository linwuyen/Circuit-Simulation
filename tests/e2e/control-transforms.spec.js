const { test, expect } = require("@playwright/test");

test("control transform bridge maps continuous pole to z-plane and quantifies delay", async ({ page }) => {
  await page.goto("/16_control_transforms/index.html");
  await expect(page.getByRole("heading", { name: /Fourier、Laplace、Z/ })).toBeVisible();
  await expect(page.locator("#stabilityBadge")).toHaveText("STABLE");
  await expect(page.locator("#zMag")).toContainText("0.9975");
  await expect(page.locator("#phaseLoss")).toHaveText("-36.0°");

  await page.locator("#sigma").evaluate(el => { el.value = "100"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await expect(page.locator("#stabilityBadge")).toHaveText("UNSTABLE");

  await page.locator("#delayUs").evaluate(el => { el.value = "20"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await expect(page.locator("#phaseLoss")).toHaveText("-72.0°");
});
