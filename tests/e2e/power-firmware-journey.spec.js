const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('core path teaches one Buck in causal order while preserving live-stage contracts', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(String(error)));

  await expect(page.locator('[data-journey-stage]')).toHaveCount(8);
  await expect(page.locator('[data-stage-id="energy"]')).toContainText('POWER PHYSICS');
  await expect(page.locator('[data-stage-id="sensing"]')).toContainText('SENSING');
  await expect(page.locator('[data-stage-id="control"]')).toContainText('FEEDBACK');
  await expect(page.locator('[data-stage-id="timing"]')).toContainText('REAL-TIME');
  await expect(page.locator('[data-stage-id="dynamics"]')).toContainText('MATH LENS');
  await expect(page.locator('[data-stage-id="safety"]')).toContainText('SAFETY');
  await expect(page.locator('[data-stage-id="production"]')).toContainText('PRODUCTION');
  await expect(page.locator('[data-stage-id="capstone"]')).toContainText('CAPSTONE');
  await expect(page.locator('#journeyModelLevel')).toContainText('L1');

  await expect(page.locator('.journey-kpis')).toContainText('FIRST ATTEMPT');
  await expect(page.locator('.journey-kpis')).toContainText('NEXT MEASUREMENT');
  await expect(page.locator('.journey-kpis')).toContainText('UNSEEN TRANSFER');
  await expect(page.locator('.journey-kpis')).toContainText('1d / 7d / 30d / 90d');
  await expect(page.locator('.journey-advanced-evidence')).not.toHaveAttribute('open', '');

  await page.locator('[data-buck-slider]').fill('60');
  await expect(page.locator('[data-buck-vout]')).toContainText('28.8 V');

  await page.locator('[data-journey-stage="1"]').click();
  await expect(page.locator('[data-sensing-live]')).toBeVisible();
  await page.locator('[data-sensing-predict="high"]').click();
  await page.locator('[data-sensing-inject]').click();
  await expect(page.locator('[data-sensing-predict-status]')).toContainText('firmware Vout');

  await page.locator('[data-journey-stage="2"]').click();
  await page.locator('[data-loop-predict="down"]').click();
  await page.locator('[data-loop-inject]').click();
  await expect(page.locator('[data-loop-predict-status]')).toContainText('physical steady-state');

  await page.locator('[data-journey-stage="3"]').click();
  await page.locator('[data-timing-predict="next"]').click();
  await page.locator('[data-timing-inject]').click();
  await expect(page.locator('[data-timing-deadline]')).toContainText('MISS');

  await page.locator('[data-journey-stage="4"]').click();
  await expect(page.locator('[data-bode-status]')).not.toBeEmpty();
  await page.locator('[data-bode-predict="down"]').click();
  await page.locator('[data-bode-inject]').click();
  await expect(page.locator('[data-bode-predict-status]')).toContainText('phase lag');

  await page.locator('[data-journey-stage="5"]').click();
  await page.locator('[data-protect-predict="hw"]').click();
  await page.locator('[data-protect-inject]').click();
  await expect(page.locator('[data-protect-veto]')).toContainText('TRIP LATCHED');
  await page.locator('[data-protect-safe-current]').click();
  await expect(page.locator('[data-protect-veto]')).toContainText('TRIP LATCHED');
  await page.locator('[data-protect-clear]').click();
  await expect(page.locator('[data-protect-veto]')).toContainText('ALLOW');

  await page.locator('[data-journey-stage="6"]').click();
  await expect(page.locator('#journeySystemQuestion')).toContainText('fresh');
  await expect(page.locator('[data-topology-response]')).toBeHidden();

  await page.locator('[data-journey-stage="7"]').click();
  await expect(page.locator('[data-debug-count]')).toHaveText('5');
  await page.locator('[data-debug-measure="adc"]').click();
  await expect(page.locator('[data-debug-quality]')).not.toHaveText('0% · 0.00 bits');
  await page.locator('[data-debug-reveal]').click();
  await expect(page.locator('[data-debug-root]')).toBeVisible();

  await expect(page.locator('.journey-specializations')).toContainText('Module 16 · Math Lens');
  await expect(page.locator('.journey-specializations')).toContainText('Module 17 · Transfer Atlas');
  await expect(page.locator('.journey-specializations')).toContainText('Module 18 · Control Grammar');
  await expect(page.locator('.journey-specializations')).toContainText('Module 19 · Executable Capstone');

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
