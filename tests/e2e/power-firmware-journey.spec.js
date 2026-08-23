const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('circuit-core-flow-v1'));
  await page.reload();
});

test('core path exposes one Buck in the ordered eight-layer causal chain', async ({ page }) => {
  const keys = ['physics', 'sensing', 'feedback', 'timing', 'dynamics', 'safety', 'production', 'evidence'];
  await expect(page.locator('[data-journey-stage]')).toHaveCount(8);
  await expect(page.locator('[data-core-resume]')).toHaveAttribute('href', '19_c2000_buck_firmware_lab/index.html?layer=physics');
  for (const key of keys) {
    await expect(page.locator(`[data-journey-stage="${key}"]`)).toHaveAttribute('href', `19_c2000_buck_firmware_lab/index.html?layer=${key}`);
  }
  await expect(page.locator('.journey-system')).toContainText('開關每一拍如何搬運能量');
  await expect(page.locator('.journey-system')).toContainText('switch node + iL ripple');
  await expect(page.locator('.journey-specializations')).toContainText('Module 15 · Debug Bank');
  await expect(page.locator('.journey-specializations')).toContainText('Module 16 · Math Lens');
  await expect(page.locator('.journey-specializations')).toContainText('Module 17 · Transfer');
  await expect(page.locator('.journey-specializations')).toContainText('Module 18 · Workbench');
  await expect(page.locator('.journey-toolbox')).not.toHaveAttribute('open', '');
  await expect(page.locator('.journey-topic-details')).not.toHaveAttribute('open', '');
});

test('journey has no document-level horizontal overflow on desktop or mobile', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }
});
