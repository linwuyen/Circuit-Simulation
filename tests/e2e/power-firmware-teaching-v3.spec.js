const { test, expect } = require('@playwright/test');

test('Module 19 persists first attempts and keeps completion controls at the active layer bottom', async ({ page }) => {
  await page.goto('/19_c2000_buck_firmware_lab/?layer=sensing');
  await page.evaluate(() => localStorage.removeItem('circuit-core-flow-v1'));
  await page.reload();
  await expect(page.locator('[data-core-footer="sensing"]')).toBeVisible();
  await expect(page.locator('[data-core-footer="sensing"] [data-core-complete]')).toBeDisabled();
  await page.locator('[data-layer-coach="sensing"] [data-layer-coach-choice="increase"]').click();
  await expect(page.locator('[data-core-footer="sensing"] [data-core-complete]')).toBeDisabled();
  await page.locator('#sensePhase').fill('90');
  await expect(page.locator('[data-core-footer="sensing"] [data-core-complete]')).toBeEnabled();
  await page.reload();
  await expect(page.locator('[data-layer-coach="sensing"]')).toHaveAttribute('data-answered', '1');
  await expect(page.locator('[data-layer-coach="sensing"]')).toHaveAttribute('data-first-attempt', 'pass');
  await expect(page.locator('#sensePhase')).toBeEnabled();
});

test('assessment appears only at Evidence in guided mode', async ({ page }) => {
  await page.goto('/19_c2000_buck_firmware_lab/?layer=physics');
  await expect(page.locator('.outcome-panel')).not.toBeVisible();
  await expect(page.locator('[data-pipeline]').first()).not.toBeVisible();
  await page.locator('[data-core-step="evidence"]').click();
  await expect(page.locator('.outcome-panel')).toBeVisible();
  await expect(page.locator('[data-evidence-predict-status]')).toContainText('claim boundary');
});

test('Module 19 stays within viewport on desktop and mobile', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const layer of ['physics', 'sensing', 'feedback', 'timing', 'dynamics', 'safety', 'production', 'evidence']) {
      await page.goto(`/19_c2000_buck_firmware_lab/?layer=${layer}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
    }
  }
});
