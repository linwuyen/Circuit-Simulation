const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('progress exposes uncertainty and measurement coverage instead of silent green', async ({ page }) => {
  await page.goto('/progress.html');
  await expect(page.locator('#mainContent')).toContainText('VERY LOW evidence');
  await expect(page.locator('#mainContent')).toContainText('Measurement coverage matrix');
  await expect(page.locator('#coverageMatrix')).toContainText('buck.current-ripple.relationship');
  await expect(page.locator('#coverageMatrix')).toContainText('verified');
});

test('fluent but non-causal report text is rejected by deterministic reasoning rubric', async ({ page }) => {
  await page.goto('/report.html?labId=buck.lab.buck-ripple');
  await page.fill('#prediction', 'L增加所以結果下降。');
  await page.fill('#parameters', 'Vin=12 V, Vout=3.3 V, L=12 µH, fsw=500 kHz');
  await page.click('#commitPrediction');
  await page.fill('#observation', '量到0.40 A而且畫面有變化。');
  await page.fill('#explanation', '因為月亮比較亮所以這個現象就發生了而且看起來很合理。');
  await page.fill('#limitations', '香蕉和天氣都是這個模型需要注意的限制。');
  await page.fill('#transfer', '換一組條件之後結果可能也會改變一些。');
  await page.click('#completeReport');
  await expect(page.locator('#reportMessage')).toContainText('Reasoning rubric');
  await expect(page.locator('#reportMessage')).toContainText('尚不能完成');
});

test('quiz exposes seeded transfer metadata rather than prompt-prefix clones', async ({ page }) => {
  await page.goto('/quiz.html?module=buck');
  const first = page.locator('.quiz-card').first();
  await expect(first).toContainText('seed');
  await expect(first).toContainText('depth');
});