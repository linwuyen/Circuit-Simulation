const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('power-firmware teaching v2 connects requirements, regions, constraints, state and observability', async ({ page }) => {
  await expect(page.locator('[data-v2-contract]')).toBeVisible();
  await expect(page.locator('[data-v2-contract-grid] article')).toHaveCount(6);
  await expect(page.locator('[data-v2-contract]')).toContainText('SYSTEM CONTRACT');
  await expect(page.locator('[data-v2-contract]')).toContainText('TIME & OWNERSHIP');

  await page.locator('[data-v2-load]').fill('120');
  await expect(page.locator('[data-v2-region]')).toHaveText('DCM');
  await expect(page.locator('[data-v2-region-valid]')).toContainText('MODEL CHANGE REQUIRED');
  await page.locator('[data-v2-load]').fill('6');
  await expect(page.locator('[data-v2-region]')).toHaveText('CCM');

  await page.locator('[data-journey-stage="1"]').click();
  await expect(page.locator('[data-v2-resolution]')).toBeVisible();
  await page.locator('[data-v2-tbprd]').fill('1000');
  await expect(page.locator('[data-v2-pwm-lsb]')).toContainText('0.100%');
  await expect(page.locator('[data-v2-pwm-vstep]')).toContainText('48.00 mV');

  await page.locator('[data-journey-stage="2"]').click();
  await expect(page.locator('[data-v2-sampling]')).toBeVisible();
  await page.locator('[data-timing-sample]').fill('1.0');
  await page.locator('[data-v2-jitter]').fill('100');
  await expect(page.locator('[data-v2-sample-phase]')).toContainText('10.0%');
  await expect(page.locator('[data-v2-ripple-error]')).not.toHaveText('+0.000 A');

  await page.locator('[data-journey-stage="3"]').click();
  await expect(page.locator('[data-v2-product-control]')).toBeVisible();
  await page.locator('[data-v2-cccv-load]').fill('2');
  await expect(page.locator('[data-v2-control-mode]')).toHaveText('CC');
  await expect(page.locator('[data-v2-cccv-i]')).toContainText('10.00 A');
  await page.locator('[data-v2-aw]').uncheck();
  await expect(page.locator('[data-v2-aw-result]')).toContainText('OFF');
  await page.locator('[data-v2-ff]').uncheck();
  await expect(page.locator('[data-v2-ff-result]')).toContainText('OFF');

  await page.locator('[data-journey-stage="4"]').click();
  await expect(page.locator('[data-v2-bandwidth]')).toBeVisible();
  await expect(page.locator('[data-v2-separation]')).toContainText('5×');
  await expect(page.locator('[data-v2-inner-phase]')).toContainText('°');

  await page.locator('[data-journey-stage="5"]').click();
  await page.locator('[data-topology="llc"]').click();
  await expect(page.locator('[data-v2-plant-name]')).toHaveText('LLC');
  await expect(page.locator('[data-v2-plant-region-list]')).toContainText('near resonance');

  await page.locator('[data-journey-stage="6"]').click();
  await expect(page.locator('[data-v2-startup]')).toBeVisible();
  await page.locator('[data-v2-startup-power]').click();
  await page.locator('[data-v2-startup-advance]').click();
  await expect(page.locator('[data-v2-startup-status]')).toContainText('ADC_NOT_VALID');
  for (const name of ['adcValid','selfTestPass','busReady','prechargeDone','softStartComplete']) {
    await page.locator(`[data-v2-qualifier="${name}"]`).check();
  }
  for (let i = 0; i < 4; i += 1) await page.locator('[data-v2-startup-advance]').click();
  await expect(page.locator('[data-v2-startup-state]')).toHaveText('RUN');
  await expect(page.locator('[data-v2-startup-pwm]')).toHaveText('ALLOW');

  await page.locator('[data-journey-stage="7"]').click();
  await expect(page.locator('[data-v2-observability]')).toBeVisible();
  await expect(page.locator('[data-v2-instrument-score]')).toContainText('100% coverage');
  await page.locator('[data-v2-age-host]').click();
  await expect(page.locator('[data-v2-ownership-table]')).toContainText('STALE');
  await page.locator('[data-v2-instrument="command_age"]').uncheck();
  await expect(page.locator('[data-v2-instrument-score]')).not.toContainText('100% coverage');
});

test('teaching v2 stays within the document viewport on desktop and mobile', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    for (let stage = 0; stage < 8; stage += 1) {
      await page.locator(`[data-journey-stage="${stage}"]`).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
    }
  }
});
