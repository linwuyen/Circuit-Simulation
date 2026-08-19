const { test, expect } = require("@playwright/test");

test("module 18 unifies module 16 control language with module 17 power-stage personalities", async ({ page }) => {
  await page.goto("/18_control_unification/index.html");

  await expect(page.getByRole("heading", { name: /把 16 的控制語言/ })).toBeVisible();
  await expect(page.locator("#controlName")).toHaveText("Duty D");
  await expect(page.locator("#plantName")).toHaveText("Buck LC power stage");
  await expect(page.locator("#passportPlant")).toContainText("LC double pole");

  await page.locator('[data-topology="llc"]').click();
  await expect(page.locator("#controlName")).toHaveText("Switching frequency fs");
  await expect(page.locator("#plantName")).toHaveText("LLC resonant tank");
  await expect(page.locator("#passportPlant")).toContainText("Resonant gain");

  await page.locator('[data-lens="sfra"]').click();
  await expect(page.locator("#lensEyebrow")).toContainText("SFRA");
  await expect(page.locator("#lensTitle")).toContainText("operating points");

  await page.locator('[data-topology="boost"]').click();
  await expect(page.locator("#passportBoundary")).toContainText("RHPZ");
  await expect(page.locator("#delayTopologyHint")).toContainText("RHP zero");

  await expect(page.locator("#phaseLoss")).toHaveText("−36.0°");
  await expect(page.locator("#estimatedPm")).toHaveText("24.0°");
  await expect(page.locator("#delayStatus")).toHaveText("RISK");

  await page.locator("#fc").evaluate(el => {
    el.value = "5000";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator("#phaseLoss")).toHaveText("−18.0°");
  await expect(page.locator("#estimatedPm")).toHaveText("42.0°");
  await expect(page.locator("#delayStatus")).toHaveText("TIGHT");

  await page.locator('[data-debug="phase"]').click();
  await expect(page.locator("#debugSuspect")).toContainText("delay");
  await expect(page.locator("#debugMeasure")).toContainText("PWM load latency");

  await page.locator('[data-new="totem"]').click();
  await expect(page.locator("#challengeTitle")).toContainText("Totem-Pole PFC");
  await expect(page.locator("#challengeP")).toContainText("bus energy");

  await expect(page.locator("body")).not.toHaveClass(/cl-theme-1617/);
});
