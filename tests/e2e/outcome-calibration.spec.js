const { test, expect } = require("@playwright/test");

test("item calibration export is explicit, privacy-minimized and first-attempt only", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.goto("/19_c2000_buck_firmware_lab/");

  await expect(page.locator("[data-calibration-export]")).toBeVisible();
  await expect(page.locator("[data-calibration-export]")).toContainText("OPT-IN ITEM CALIBRATION");
  await expect(page.locator("[data-calibration-export]")).toContainText("first-attempt 正誤");
  await expect(page.locator("[data-calibration-export]")).toContainText("不含 prompt、choice 或實際作答內容");

  await page.locator("[data-outcome-choice]").first().click();
  await expect(page.locator("#outcomeDashboard")).toContainText("1/8 first attempts");
  await page.locator("#outcomeParticipantId").fill("cal_browser_001");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#outcomeCalibrationDownload").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("cal_browser_001.outcome-calibration.json");
  await expect(page.locator("#outcomeCalibrationStatus")).toContainText("item correctness: yes");
  await expect(page.locator("#outcomeCalibrationStatus")).toContainText("raw answers/prompts: no");

  const exported = await page.evaluate(() => {
    const bundle = window.CircuitOutcomeCalibrationV1.exportParticipant(
      window.CircuitOutcomeSessionV1.summary(),
      { participantId:"cal_probe" }
    );
    const row = bundle.phases.pre.rows[0];
    return {
      schema: bundle.schema,
      profile: bundle.outcomeProfile,
      instrument: bundle.instrument,
      privacy: [bundle.containsItemCorrectness, bundle.containsRawAnswers, bundle.containsPrompts],
      rowKeys: Object.keys(row).sort(),
      hasAnswer: Object.prototype.hasOwnProperty.call(row, "answer"),
      hasPrompt: Object.prototype.hasOwnProperty.call(row, "prompt"),
      hasChoices: Object.prototype.hasOwnProperty.call(row, "choices")
    };
  });
  expect(exported.schema).toBe("circuit-outcome-calibration");
  expect(exported.profile).toBe("core8");
  expect(exported.instrument.seed).toBe(20260821);
  expect(exported.instrument.countPerCompetency).toBe(1);
  expect(exported.instrument.contractFingerprint).toMatch(/^[0-9a-f]{16}$/);
  expect(exported.privacy).toEqual([true, false, false]);
  expect(exported.rowKeys).toEqual(["caseId", "competency", "correct"]);
  expect(exported.hasAnswer).toBe(false);
  expect(exported.hasPrompt).toBe(false);
  expect(exported.hasChoices).toBe(false);
  expect(errors).toEqual([]);
});
