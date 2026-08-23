const { test, expect } = require('@playwright/test');

test('top-level learning pages prioritize one current action and collapse the libraries', async ({ page }) => {
  await page.goto('/beginner.html');
  await expect(page.locator('.core-page-resume')).toContainText('01 · 物理');
  await expect(page.locator('.core-page-layers .core-page-layer')).toHaveCount(8);
  await expect(page.locator('.core-page-library')).not.toHaveAttribute('open', '');
  await expect(page.locator('.core-page-library .lab')).toHaveCount(16);

  await page.goto('/labs.html');
  await expect(page.locator('.core-page-resume')).toContainText('RECOMMENDED NOW');
  await expect(page.locator('.core-page-library')).not.toHaveAttribute('open', '');
  expect(await page.locator('#labGrid .lab').count()).toBeGreaterThanOrEqual(50);

  await page.goto('/troubleshooting.html');
  await expect(page.locator('.core-page-resume')).toContainText('先量第一個分歧點');
  await expect(page.locator('.core-page-library')).not.toHaveAttribute('open', '');

  await page.goto('/progress.html');
  await expect(page.locator('.core-page-layers .core-page-layer')).toHaveCount(8);
  await expect(page.locator('.core-page-library')).not.toHaveAttribute('open', '');

  await page.goto('/quiz.html');
  await expect(page.locator('.quiz-card:visible')).toHaveCount(1);
  await expect(page.locator('.core-quiz-pager')).toBeVisible();
});

test('simplified pages stay within the document viewport', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const path of ['/', '/beginner.html', '/labs.html', '/troubleshooting.html', '/progress.html', '/quiz.html']) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
    }
  }
});
