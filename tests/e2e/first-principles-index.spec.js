const { test, expect } = require('@playwright/test');

test('homepage separates unified resume from the preserved eight-layer entry', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.journey-shell')).toBeVisible();
  await expect(page.locator('[data-core-resume]')).toHaveCount(1);
  await expect(page.locator('[data-unified-resume]')).toHaveCount(1);
  await expect(page.locator('[data-unified-resume]')).toHaveAttribute('href', /learn_basics.html#duty$/);
  await expect(page.locator('[data-core-resume]')).toHaveAttribute('href', '19_c2000_buck_firmware_lab/index.html?layer=physics');
  await expect(page.locator('[data-core-resume]')).toContainText('八層課程入口：01 物理');
  await expect(page.locator('.journey-advanced-evidence')).not.toHaveAttribute('open', '');
  await expect(page.locator('[data-power-teaching-v2]')).toHaveCount(0);
  await expect(page.locator('[data-power-teaching-v3]')).toHaveCount(0);
});

test('timing and protection boundaries live in the canonical Module 19 player', async ({ page }) => {
  await page.goto('/19_c2000_buck_firmware_lab/?layer=timing');
  await expect(page.locator('#learning-navigation a').filter({ hasText: '同一案例實驗' })).toHaveAttribute('href', /learnFrom=core-timing$/);
  await page.locator('[data-timing-predict="next"]').click();
  await page.locator('[data-timing-fault]').click();
  await expect(page.locator('#timingMiss')).toHaveText('1');
  await expect(page.locator('#timingBoundary')).toContainText('Hardware cannot time-travel');

  await page.locator('[data-core-step="safety"]').click();
  await page.locator('[data-layer-coach="safety"] [data-layer-coach-choice="hardware"]').click();
  await expect(page.locator('#safeBoundary')).toContainText('BOARD claim');
  await expect(page.locator('[data-layer-coach="safety"] [data-layer-coach-status]')).toContainText('fault-to-PWM-low latency');
});
