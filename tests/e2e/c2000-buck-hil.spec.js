const { test, expect } = require("@playwright/test");

test("guided Buck lessons are prediction-first and equation-backed", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto("/19_c2000_buck_firmware_lab/");

  await expect(page.locator('[data-learning-mode="guided"]')).toHaveClass(/selected/);
  await expect(page.locator("[data-pipeline]").first()).toContainText("Power Stage");

  await expect(page.locator("#inductanceRange")).toBeDisabled();
  await expect(page.locator("#physicsDuty")).toHaveText("25.00 %");
  await expect(page.locator("#physicsTon")).toHaveText("2.500 µs");
  await expect(page.locator("#physicsToff")).toHaveText("7.500 µs");
  await expect(page.locator("#physicsRipple")).toHaveText("0.450 A");
  await page.locator('[data-physics-predict="lower"]').click();
  await expect(page.locator("#inductanceRange")).toBeEnabled();
  await page.locator("#inductanceRange").fill("400");
  await expect(page.locator("#physicsRipple")).toHaveText("0.225 A");
  await expect(page.locator("#physicsResidual")).toContainText("e-");
  await expect(page.locator("#buckWaveform .current-wave")).toHaveAttribute("d", /L/);

  await expect(page.locator("#computeRange")).toBeDisabled();
  await expect(page.locator("#timingPeriod")).toHaveText("10.00 µs");
  await expect(page.locator("#timingDone")).toHaveText("5.50 µs");
  await expect(page.locator("#timingCommit")).toHaveText("10.00 µs");
  await expect(page.locator("#timingMiss")).toHaveText("0");
  await expect(page.locator("#timingPhase")).toHaveText("-36.0°");
  await page.locator('[data-timing-predict="next"]').click();
  await page.locator("[data-timing-fault]").click();
  await expect(page.locator("#timingDone")).toHaveText("10.50 µs");
  await expect(page.locator("#timingCommit")).toHaveText("20.00 µs");
  await expect(page.locator("#timingMiss")).toHaveText("1");
  await expect(page.locator("#timingPhase")).toHaveText("-72.0°");

  await page.locator("[data-timing-transfer]").click();
  await expect(page.locator("#timingPeriod")).toHaveText("5.00 µs");
  await expect(page.locator("#timingDone")).toHaveText("5.50 µs");
  await expect(page.locator("#timingCommit")).toHaveText("10.00 µs");
  await expect(page.locator("#timingMiss")).toHaveText("1");
  await expect(page.locator("#timingPhase")).toHaveText("-36.0°");
  expect(errors).toEqual([]);
});

test("debug mode exposes deterministic HIL and physical board evidence stays unclaimed", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto("/19_c2000_buck_firmware_lab/");
  await page.locator('[data-learning-mode="debug"]').click();

  await expect(page.locator("#hilPass")).toHaveText("PASS");
  await expect(page.locator("#hilState")).toContainText(/SOFT_START|RUN/);

  for (const scenario of ["load-step", "ocp", "ovp", "adc-stuck", "command-timeout", "idle-off"]) {
    await page.locator(`[data-scenario="${scenario}"]`).click();
    await expect(page.locator("#hilScenario")).toHaveText(scenario);
    await expect(page.locator("#hilPass")).toHaveText("PASS");
  }

  await page.locator('[data-scenario="ocp"]').click();
  await expect(page.locator("#hilState")).toHaveText("FAULT_LATCHED");
  await expect(page.locator("#hilFault")).toContainText("OCP");
  await expect(page.locator("#hilDuty")).toHaveText("0.0 %");

  await page.locator('[data-scenario="idle-off"]').click();
  await expect(page.locator("#hilState")).toHaveText("OFF");
  await expect(page.locator("#hilDuty")).toHaveText("0.0 %");

  const slots = page.locator("[data-evidence]");
  await expect(slots).toHaveCount(8);
  await expect(page.locator("#evidenceCount")).toHaveText("0/8");
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
