const { test, expect } = require('@playwright/test');

test('Module 19 exposes one precise first-principles map for every core layer', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('/19_c2000_buck_firmware_lab/');
  await expect(page.locator('[data-precision-card]')).toHaveCount(8);

  for (const layer of ['physics', 'sensing', 'feedback', 'timing', 'dynamics', 'safety', 'production', 'evidence']) {
    const card = page.locator(`[data-precision-card="${layer}"]`);
    await expect(card).toContainText('Firmware cares');
    await expect(card).toContainText('真板先量');
    await expect(card).toContainText('不能越界');
    await expect(card).toContainText('Debug rule');
  }

  expect(errors).toEqual([]);
});

test('feedback page teaches the same cascaded voltage/current architecture as target code', async ({ page }) => {
  await page.goto('/19_c2000_buck_firmware_lab/');
  await expect(page.locator('[data-precision-card]')).toHaveCount(8);
  await page.locator('[data-core-step="feedback"]').click();

  await expect(page.locator('[data-core-layer-panel="feedback"] h2')).toContainText('Iref');
  await expect(page.locator('.feedback-loop-chain')).toContainText('Voltage PI');
  await expect(page.locator('.feedback-loop-chain')).toContainText('Current PI');
  await expect(page.locator('.feedback-code-map')).toContainText('current_reference');
  await expect(page.locator('#feedbackCurrentKp')).toBeDisabled();

  await page.locator('[data-layer-coach="feedback"] [data-layer-coach-choice="both-up"]').click();
  await expect(page.locator('[data-layer-coach="feedback"] [data-layer-coach-status]')).toContainText('r − ŷ');
  await expect(page.locator('#feedbackCurrentKp')).toBeEnabled();
  await page.locator('#feedbackCurrentKp').fill('0.03');
  await expect(page.locator('#feedbackIRef')).toContainText('A');
  await expect(page.locator('#feedbackIL')).toContainText('A');
  await expect(page.locator('#feedbackBoundary')).toContainText('buck_control.c');
});

test('a wrong first attempt requires corrective transfer before lesson completion', async ({ page }) => {
  await page.goto('/19_c2000_buck_firmware_lab/');
  await page.evaluate(() => localStorage.removeItem('circuit-core-flow-v1'));
  await page.reload();
  await expect(page.locator('[data-precision-card]')).toHaveCount(8);

  await page.locator('[data-core-step="sensing"]').click();
  await page.locator('[data-layer-coach="sensing"] [data-layer-coach-choice="same"]').click();
  await expect(page.locator('[data-remediation="sensing"]')).toBeVisible();

  await page.locator('#sensePhase').fill('90');
  const complete = page.locator('[data-core-footer="sensing"] [data-core-complete]');
  await expect(complete).toBeDisabled();

  await page.locator('[data-remediation="sensing"] [data-remediation-choice="low"]').click();
  await expect(page.locator('[data-remediation="sensing"] [data-remediation-status]')).toContainText('修正通過');
  await expect(complete).toBeEnabled();

  const state = await page.evaluate(() => window.CircuitCoreFlowV1.snapshot());
  expect(state.predictions.sensing.correct).toBe(false);
  expect(state.remediations.sensing).toBeTruthy();
});