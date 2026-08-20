const { test, expect } = require("@playwright/test");

test("C2000 Buck lab exposes executable pipeline and deterministic fault evidence", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto("/19_c2000_buck_firmware_lab/");

  await expect(page.locator("[data-pipeline]").first()).toContainText("ePWM1 SOCA");
  await expect(page.locator("#hilPass")).toHaveText("PASS");
  await expect(page.locator("#hilState")).toContainText(/SOFT_START|RUN/);

  for (const scenario of ["load-step", "ocp", "ovp", "adc-stuck", "command-timeout"]) {
    await page.locator(`[data-scenario="${scenario}"]`).click();
    await expect(page.locator("#hilScenario")).toHaveText(scenario);
    await expect(page.locator("#hilPass")).toHaveText("PASS");
  }

  await page.locator('[data-scenario="ocp"]').click();
  await expect(page.locator("#hilState")).toHaveText("FAULT_LATCHED");
  await expect(page.locator("#hilFault")).toContainText("OCP");
  await expect(page.locator("#hilDuty")).toHaveText("0.0 %");

  const slots = page.locator("[data-evidence]");
  await expect(slots).toHaveCount(8);
  await slots.nth(0).check();
  await slots.nth(1).check();
  await expect(page.locator("#evidenceCount")).toHaveText("2/8");
  expect(errors).toEqual([]);
});

test("homepage links the executable C2000 Buck lab and both pages avoid overflow", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("[data-c2000-buck-lab-entry]")).toBeVisible();
    await expect(page.locator('[data-c2000-buck-lab-entry] a')).toHaveAttribute("href", "19_c2000_buck_firmware_lab/index.html");
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);

    await page.goto("/19_c2000_buck_firmware_lab/");
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }
});
