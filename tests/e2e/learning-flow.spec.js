const { test, expect } = require('@playwright/test');

test('all top-level pages load without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const path of ['/', '/beginner.html', '/labs.html', '/troubleshooting.html', '/progress.html', '/quiz.html', '/search.html', '/glossary.html', '/report.html']) {
    await page.goto(path);
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('#mainContent')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('lab link keeps the full lab id and selects the exact worksheet', async ({ page }) => {
  await page.goto('/labs.html');
  const link = page.locator('a[href*="report.html?labId="]').first();
  const href = await link.getAttribute('href');
  expect(href).toMatch(/labId=[^&]+\.lab\./);
  await link.click();
  await expect(page).toHaveURL(/report\.html\?labId=/);
  const selected = await page.locator('#labSelect').inputValue();
  expect(decodeURIComponent(href.split('labId=')[1])).toBe(selected);
});

test('worksheet requires meaningful engineering evidence and persists', async ({ page }) => {
  await page.goto('/report.html');
  await page.fill('#prediction', '增加 L，電流漣波會下降，因為 di/dt 變小。');
  await page.fill('#parameters', 'Vin=24 V, Vout=12 V, L=100 µH, fsw=100 kHz');
  await page.fill('#observation', '漣波由 1.2 A 降到 0.6 A，波形仍為三角波。');
  await page.fill('#explanation', '電感電流斜率由 vL/L 決定，因此 L 加倍時斜率與漣波約減半。');
  await page.fill('#limitations', '忽略電感 DCR、開關壓降與量測頻寬。');
  await page.fill('#transfer', '將 fsw 加倍後漣波也約減半，方向一致。');
  await page.click('#completeReport');
  await expect(page.locator('#reportMessage')).toContainText('完成');
  await page.reload();
  await expect(page.locator('#prediction')).toHaveValue(/增加 L/);
});

test('quiz exposes misconception feedback and progress survives reload', async ({ page }) => {
  await page.goto('/quiz.html');
  const firstCard = page.locator('.quiz-card').first();
  const wrong = firstCard.locator('.quiz-option').first();
  await wrong.click();
  await expect(firstCard.locator('.quiz-result')).not.toBeEmpty();
  await page.reload();
  await expect(page.locator('.quiz-card').first()).toBeVisible();
});

test('mobile pages do not overflow horizontally', async ({ page }) => {
  for (const path of ['/', '/beginner.html', '/report.html']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  }
});
