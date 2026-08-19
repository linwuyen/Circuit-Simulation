const { test, expect } = require("@playwright/test");

test("control transform bridge maps continuous pole to z-plane and quantifies delay", async ({ page }) => {
  await page.goto("/16_control_transforms/index.html");
  await expect(page.getByRole("heading", { name: /Fourier、Laplace、Z/ })).toBeVisible();
  await expect(page.locator("#mental-model")).toContainText("Laplace：這個系統天生會怎麼動");
  await expect(page.locator("#stabilityBadge")).toHaveText("STABLE");
  await expect(page.locator("#zMag")).toContainText("0.9975");
  await expect(page.locator("#phaseLoss")).toHaveText("-36.0°");
  await expect(page.locator("#delayCycleRatio")).toHaveText("10%");
  await expect(page.locator("#piInterpretation")).toContainText("PI zero");

  await page.locator('[data-pole-preset="marginal"]').click();
  await expect(page.locator("#stabilityBadge")).toContainText("MARGINAL");
  await expect(page.locator("#zMag")).toHaveText("1");
  await expect(page.locator("#poleMath")).toContainText("unit circle");

  await page.locator("#sigma").evaluate(el => { el.value = "100"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await expect(page.locator("#stabilityBadge")).toHaveText("UNSTABLE");
  await expect(page.locator("#polePlain")).toContainText("放大");

  await page.locator("#delayUs").evaluate(el => { el.value = "20"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await expect(page.locator("#phaseLoss")).toHaveText("-72.0°");
  await expect(page.locator("#delayCycleRatio")).toHaveText("20%");
  await expect(page.locator("#delayInterpretation")).toContainText("危險");

  await page.locator(".reveal").first().click();
  await expect(page.locator("#answer1")).toBeVisible();
  await expect(page.locator("#answer1")).toContainText("unit circle");
});
