const { test, expect } = require("@playwright/test");

test("guided Buck capstone is equation-backed across all eight layers", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto("/19_c2000_buck_firmware_lab/");

  await expect(page.locator('[data-learning-mode="guided"]')).toHaveClass(/selected/);
  await expect(page.locator("[data-pipeline]").first()).toContainText("Power Stage");
  await expect(page.locator("[data-mental-view-button]")).toHaveCount(5);
  await expect(page.locator("[data-mental-view-stage]")).toContainText("能量真的怎麼流");
  await page.locator('[data-mental-view-button="signal"]').click();
  await expect(page.locator("[data-mental-view-stage]")).toContainText("ADC pin");
  await page.locator('[data-mental-view-button="time"]').click();
  await expect(page.locator("[data-mental-view-stage]")).toContainText("CMPA shadow write");
  await page.locator('[data-mental-view-button="authority"]').click();
  await expect(page.locator("[data-mental-view-stage]")).toContainText("PWM grant");
  await expect(page.locator(".capstone-role-note")).toContainText("Module 15 Debug Challenge Bank");

  await expect(page.locator("#inductanceRange")).toBeDisabled();
  await expect(page.locator("#physicsDuty")).toHaveText("25.00 %");
  await expect(page.locator("#physicsTon")).toHaveText("2.500 µs");
  await expect(page.locator("#physicsToff")).toHaveText("7.500 µs");
  await expect(page.locator("#physicsRipple")).toHaveText("0.450 A");
  await page.locator('[data-physics-predict="lower"]').click();
  await expect(page.locator("[data-physics-predict-status]")).toContainText("真板先量");
  await page.locator("#inductanceRange").fill("400");
  await expect(page.locator("#physicsRipple")).toHaveText("0.225 A");
  await expect(page.locator("#buckWaveform .current-wave")).toHaveAttribute("d", /L/);

  await expect(page.locator("#timingPeriod")).toHaveText("10.00 µs");
  await expect(page.locator("#timingDone")).toHaveText("5.50 µs");
  await expect(page.locator("#timingCommit")).toHaveText("10.00 µs");
  await page.locator('[data-timing-predict="next"]').click();
  await expect(page.locator("[data-timing-predict-status]")).toContainText("真板先量");
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

  await expect(page.locator("[data-dynamics-story]")).toContainText("負載突然增加");
  await expect(page.locator("[data-dynamics-story]")).toContainText("Bode 的用途");
  await expect(page.locator("#dynDelayPhase")).toHaveText("-36.0°");
  await expect(page.locator("#safeHardware")).toHaveText("230 ns");
  await expect(page.locator("#safeSoftware")).toHaveText("5.50 µs");

  await expect(page.locator("#prodFaultAt")).toHaveText("501 ticks / 5.01 ms");
  await expect(page.locator("#prodState")).toHaveText("RUN");
  await expect(page.locator("[data-authority-model] .authority-equation")).toContainText("PWM_AUTHORITY");
  await expect(page.locator("[data-authority-result]")).toContainText("GRANTED");
  await expect(page.locator("[data-ownership-ledger]")).toContainText("Host / comm producer");
  await expect(page.locator("[data-ownership-ledger]")).toContainText("consumer 不能替 producer 刷 freshness");
  await expect(page.locator("[data-ownership-ledger]")).toContainText("ePWM");
  await expect(page.locator("#prodMissed")).toBeDisabled();
  await page.locator('[data-layer-coach="production"] [data-layer-coach-choice="fail-closed"]').click();
  await expect(page.locator("#prodMissed")).toBeEnabled();
  await page.locator("#prodMissed").fill("501");
  await expect(page.locator("#prodState")).toHaveText("FAULT_LATCHED");
  await expect(page.locator('[data-authority-condition="fresh"]')).toHaveAttribute("data-pass", "0");
  await expect(page.locator("[data-authority-result]")).toContainText("DENIED");

  await expect(page.locator("#transferDuty")).toHaveText("50.00 %");
  await expect(page.locator("#transferRhp")).toContainText("kHz");
  await expect(page.locator("[data-transfer-bridge]")).toContainText("Boost PFC");
  await expect(page.locator("[data-transfer-bridge]")).toContainText("LLC");
  await expect(page.locator('[data-transfer-bridge] a')).toHaveAttribute("href", "../17_power_topology_control/index.html#atlas");
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

test("module 15 is a diagnosis challenge bank, not a second capstone", async ({ page }) => {
  await page.goto("/15_power_capstone/");
  await expect(page).toHaveTitle(/Debug Challenge Bank/);
  await expect(page.locator("h1")).toContainText("未知故障");
  await expect(page.locator(".lead")).toContainText("Module 19 是 authoritative executable capstone");
  await expect(page.locator('a[href="../19_c2000_buck_firmware_lab/index.html"]').first()).toBeVisible();
  await expect(page.locator("main")).toContainText("先證明 signal existence，再證明 timing");
  const role = await page.evaluate(() => {
    const module = window.CircuitCurriculum?.modules?.find(item => item.id === "power-capstone");
    return module ? { title: module.title, tag: module.tag } : null;
  });
  expect(role).toEqual({ title: "Power Firmware Debug Challenge Bank", tag: "Debug Lab" });
});

test("debug practice randomizes faults but keeps measurement order falsifiable", async ({ page }) => {
  await page.goto("/19_c2000_buck_firmware_lab/?debug_case=stale-command");
  await expect(page.locator('[data-diagnostic-challenge]')).toHaveAttribute("data-case-id", "stale-command");
  await page.locator('[data-learning-mode="debug"]').click();
  await expect(page.locator("#hilScenario")).toHaveText("command-timeout");
  await page.locator('[data-diagnostic-choice="command-age"]').click();
  await expect(page.locator("[data-diagnostic-status]")).toContainText("最高資訊量方向正確");
  await expect(page.locator("[data-diagnostic-status]")).toContainText("外部 producer");

  await page.goto("/19_c2000_buck_firmware_lab/");
  await page.locator('[data-learning-mode="debug"]').click();
  const before = await page.locator('[data-diagnostic-challenge]').getAttribute("data-case-id");
  await page.locator('[data-diagnostic-next]').click();
  await expect(page.locator('[data-diagnostic-challenge]')).not.toHaveAttribute("data-case-id", before);
});

test("deep links select the authoritative Module 19 layer and evidence mode", async ({ page }) => {
  await page.goto("/19_c2000_buck_firmware_lab/?layer=production");
  await expect(page.locator("#prodTimeout").locator("xpath=ancestor::article[1]")).toHaveAttribute("data-core-focus", "production");
  await expect(page.locator('[data-learning-mode="guided"]')).toHaveClass(/selected/);

  await page.goto("/19_c2000_buck_firmware_lab/?layer=evidence&debug_case=stale-command");
  await expect(page.locator('[data-learning-mode="debug"]')).toHaveClass(/selected/);
  await expect(page.locator("#boardClaim").locator("xpath=ancestor::section[1]")).toHaveAttribute("data-core-focus", "evidence");
  await expect(page.locator("#boardClaim").locator("xpath=ancestor::section[1]")).not.toHaveClass(/mode-hidden/);
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

test("outcome benchmark records immutable core8 first attempts and home surfaces real state", async ({ page }) => {
  await page.goto("/19_c2000_buck_firmware_lab/");
  await expect(page.locator("#outcomeDashboard")).toHaveAttribute("data-profile", "core8");
  await expect(page.locator("#outcomeDashboard")).toContainText("CORE LAYERS");
  await expect(page.locator("#outcomeDashboard")).toContainText("0/8 first attempts");
  await expect(page.locator("#outcomeQuestion")).toContainText("PRE · CORE8");
  await page.locator("[data-outcome-choice]").first().click();
  await expect(page.locator("#outcomeDashboard")).toContainText("1/8 first attempts");

  await page.goto("/");
  const homeOutcome = page.locator("[data-outcome-home]");
  const advancedEvidence = page.locator(".journey-advanced-evidence");
  await expect(homeOutcome).toBeAttached();
  await expect(homeOutcome).not.toBeVisible();
  await expect(advancedEvidence).not.toHaveAttribute("open", "");
  await advancedEvidence.locator("summary").click();
  await expect(advancedEvidence).toHaveAttribute("open", "");
  await expect(homeOutcome).toBeVisible();
  await expect(homeOutcome).toContainText("1/8 first attempts");
});

test("homepage makes Module 19 the single core path and hides the topic library by default", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("[data-c2000-buck-lab-entry]")).toBeVisible();
    await expect(page.locator('[data-c2000-buck-lab-entry] a').first()).toHaveAttribute("href", "19_c2000_buck_firmware_lab/index.html?layer=physics");
    await expect(page.locator('[data-journey-stage] .journey-enter[data-core-layer]')).toHaveCount(8);
    for (const layer of ["physics", "sensing", "feedback", "timing", "dynamics", "safety", "production", "evidence"]) {
      await expect(page.locator(`.journey-enter[data-core-layer="${layer}"]`)).toHaveAttribute("href", `19_c2000_buck_firmware_lab/index.html?layer=${layer}`);
    }
    await expect(page.locator("[data-topic-index]")).not.toHaveAttribute("open", "");
    await expect(page.locator("[data-topic-index] summary")).toContainText("不是建議學習順序");
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);

    await page.goto("/19_c2000_buck_firmware_lab/");
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }
});
