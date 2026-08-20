const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('8-stage journey shares one state model and core interactions work', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(String(error)));
  await expect(page.locator('[data-journey-stage]')).toHaveCount(8);
  await expect(page.locator('#journeyModelLevel')).toContainText('L1');

  await page.locator('[data-buck-slider]').fill('60');
  await expect(page.locator('[data-buck-vout]')).toContainText('28.8 V');

  await page.locator('[data-journey-stage="1"]').click();
  await expect(page.locator('[data-sensing-live]')).toBeVisible();
  await page.locator('[data-sensing-predict="high"]').click();
  await page.locator('[data-sensing-inject]').click();
  await expect(page.locator('[data-sensing-predict-status]')).toContainText('firmware Vout');

  await page.locator('[data-journey-stage="2"]').click();
  await page.locator('[data-timing-predict="next"]').click();
  await page.locator('[data-timing-inject]').click();
  await expect(page.locator('[data-timing-deadline]')).toContainText('MISS');

  await page.locator('[data-journey-stage="3"]').click();
  await page.locator('[data-loop-predict="down"]').click();
  await page.locator('[data-loop-inject]').click();
  await expect(page.locator('[data-loop-predict-status]')).toContainText('physical steady-state');

  await page.locator('[data-journey-stage="4"]').click();
  await expect(page.locator('[data-bode-status]')).not.toBeEmpty();
  await page.locator('[data-bode-predict="down"]').click();
  await page.locator('[data-bode-inject]').click();
  await expect(page.locator('[data-bode-predict-status]')).toContainText('phase lag');

  await page.locator('[data-journey-stage="5"]').click();
  await page.locator('[data-topology="boost"]').click();
  await page.locator('[data-boost-predict="down"]').click();
  const boostPath = await page.locator('[data-topology-response]').getAttribute('d');
  expect(boostPath).toContain('L');
  await expect(page.locator('[data-boost-status]')).toContainText('先反向');

  await page.locator('[data-journey-stage="6"]').click();
  await page.locator('[data-protect-predict="hw"]').click();
  await page.locator('[data-protect-inject]').click();
  await expect(page.locator('[data-protect-veto]')).toContainText('TRIP LATCHED');
  await page.locator('[data-protect-safe-current]').click();
  await expect(page.locator('[data-protect-veto]')).toContainText('TRIP LATCHED');
  await page.locator('[data-protect-clear]').click();
  await expect(page.locator('[data-protect-veto]')).toContainText('ALLOW');

  await page.locator('[data-journey-stage="7"]').click();
  await expect(page.locator('[data-debug-count]')).toHaveText('5');
  await page.locator('[data-debug-measure="adc"]').click();
  await expect(page.locator('[data-debug-quality]')).not.toHaveText('0% · 0.00 bits');
  await page.locator('[data-debug-reveal]').click();
  await expect(page.locator('[data-debug-root]')).toBeVisible();

  expect(runtimeErrors).toEqual([]);
});

test('journey has no document-level horizontal overflow on desktop or mobile', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    for (let i = 0; i < 8; i += 1) {
      await page.locator(`[data-journey-stage="${i}"]`).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
    }
  }
});
