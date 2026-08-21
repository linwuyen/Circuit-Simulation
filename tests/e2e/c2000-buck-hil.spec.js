const { test, expect } = require("@playwright/test");

test("guided Buck capstone is equation-backed across all eight layers", async ({ page }) => {
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
  await page.locator("#inductanceRange").fill("400");
  await expect(page.locator("#physicsRipple")).toHaveText("0.225 A");
  await expect(page.locator("#buckWaveform .current-wave")).toHaveAttribute("d", /L/);

  await expect(page.locator("#timingPeriod")).toHaveText("10.00 µs");
  await expect(page.locator("#timingDone")).toHaveText("5.50 µs");
  await expect(page.locator("#timingCommit")).toHaveText("10.00 µs");
  await page.locator('[data-timing-predict="next"]').click();
  await page.locator("[data-timing-fault]").click();
  await expect(page.locator("#timingDone")).toHaveText("10.50 µs");
  await expect(page.locator("#timingCommit")).toHaveText("20.00 µs");
  await expect(page.locator("#timingMiss")).toHaveText("1");

  await expect(page.locator("[data-layer-coach]")).toHaveCount(6);
  await expect(page.locator("#sensePhase")).toBeDisabled();
  await page.locator('[data-layer-coach="sensing"] [data-layer-coach-choice="increase"]').click();
  await expect(page.locator('[data-layer-coach="sensing"] [data-layer-coach-status]')).toContainText("先量：");
  await expect(page.locator("#sensePhase")).toBeEnabled();
  await expect(page.locator("#senseCode")).toContainText("/4095");
  await page.locator("#sensePhase").fill("90");
  await expect(page.locator("#sensePhysical")).toHaveText("12.1000 V");

  await expect(page.locator("#feedbackPlot .current-wave")).toHaveAttribute("d", /L/);
  await expect(page.locator("#feedbackFinal")).toContainText("V");

  await expect(page.locator("#dynDelayPhase")).toHaveText("-36.0°");
  await expect(page.locator("#safeHardware")).toHaveText("230 ns");
  await expect(page.locator("#safeSoftware")).toHaveText("5.50 µs");

  await expect(page.locator("#prodFaultAt")).toHaveText("501 ticks / 5.01 ms");
  await expect(page.locator("#prodState")).toHaveText("RUN");
  await expect(page.locator("#prodMissed")).toBeDisabled();
  await page.locator('[data-layer-coach="production"] [data-layer-coach-choice="fail-closed"]').click();
  await expect(page.locator("#prodMissed")).toBeEnabled();
  await page.locator("#prodMissed").fill("501");
  await expect(page.locator("#prodState")).toHaveText("FAULT_LATCHED");

  await expect(page.locator("#transferDuty")).toHaveText("50.00 %");
  await expect(page.locator("#transferRhp")).toContainText("kHz");
  expect(errors).toEqual([]);
});

test("guided layer coaches unlock outside guided mode without leaking first-attempt answers", async ({ page }) => {
  await page.goto("/19_c2000_buck_firmware_lab/");

  await expect(page.locator("#feedbackRef")).toBeDisabled();
  await page.locator('[data-learning-mode="sandbox"]').click();
  await expect(page.locator("#feedbackRef")).toBeEnabled();

  await page.locator('[data-learning-mode="guided"]').click();
  await expect(page.locator("#feedbackRef")).toBeDisabled();
  await page.locator('[data-layer-coach="feedback"] [data-layer-coach-choice="both-up"]').click();
  await expect(page.locator("#feedbackRef")).toBeEnabled();
  await expect(page.locator('[data-layer-coach="feedback"] [data-layer-coach-status]')).toContainText("r − ŷ");
});

test("debug mode exposes deterministic HIL and board claim is manifest-backed", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto("/19_c2000_buck_firmware_lab/");
  await page.locator('[data-learning-mode="debug"]').click();

  await expect(page.locator("#hilPass")).toHaveText("PASS");
  for (const scenario of ["load-step", "ocp", "ovp", "adc-stuck", "command-timeout", "idle-off"]) {
    await page.locator(`[data-scenario="${scenario}"]`).click();
    await expect(page.locator("#hilScenario")).toHaveText(scenario);
    await expect(page.locator("#hilPass")).toHaveText("PASS");
  }

  await expect(page.locator("#boardClaim")).toHaveText("UNCLAIMED");
  await expect(page.locator("#boardManifestStatus")).toContainText("Target build PASS");
  await expect(page.locator("#boardBindingTable tr")).toHaveCount(9);
  await expect(page.locator("#boardEvidence .evidence-slot")).toHaveCount(8);
  await expect(page.locator("#evidenceCount")).toHaveText("0/8");
  await expect(page.locator("#boardBoundary")).toContainText("Fail-closed");
  expect(errors).toEqual([]);
});

test("outcome benchmark records immutable first attempts and home surfaces real state", async ({ page }) => {
  await page.goto("/19_c2000_buck_firmware_lab/");
  await expect(page.locator("#outcomeDashboard")).toContainText("0/8 first attempts");
  await expect(page.locator("#outcomeQuestion")).toContainText("PRE");
  await page.locator("[data-outcome-choice]").first().click();
  await expect(page.locator("#outcomeDashboard")).toContainText("1/8 first attempts");

  await page.goto("/");
  await expect(page.locator("[data-outcome-home]")).toBeVisible();
  await expect(page.locator("[data-outcome-home]")).toContainText("1/8 first attempts");
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
