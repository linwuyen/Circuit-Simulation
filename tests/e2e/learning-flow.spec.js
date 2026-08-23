const { test, expect } = require('@playwright/test');

test('all top-level pages load without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const path of ['/', '/beginner.html', '/labs.html', '/troubleshooting.html', '/progress.html', '/quiz.html', '/search.html', '/glossary.html', '/report.html']) {
    await page.goto(path);
    await expect(page.locator('nav.topnav')).toBeVisible();
    await expect(page.locator('#mainContent')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('lab link keeps the full lab id and selects the exact worksheet', async ({ page }) => {
  await page.goto('/labs.html');
  await page.locator('.core-page-library > summary').click();
  const link = page.locator('a[href*="report.html?labId="]').first();
  const href = await link.getAttribute('href');
  expect(href).toMatch(/labId=[^&]+\.lab\./);
  await link.click();
  await expect(page).toHaveURL(/report\.html\?labId=/);
  const selected = await page.locator('#labSelect').inputValue();
  expect(decodeURIComponent(href.split('labId=')[1])).toBe(selected);
});

test('simulator interaction becomes machine evidence in the matching worksheet', async ({ page }) => {
  await page.goto('/0_buck_converter_/2_current_ripple.html');
  await expect(page.locator('.clt-root')).toBeAttached();
  await page.locator('#ind').evaluate(el => {
    el.value = '4.4';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  await page.goto('/report.html?labId=buck.lab.buck-ripple');
  await expect(page.locator('#machineEvidence')).toContainText(/Machine: [1-9]/);
});

test('worksheet requires a committed prediction and persists revisions', async ({ page }) => {
  await page.goto('/report.html');
  await page.fill('#prediction', '增加L會讓電流漣波下降因為電感電流斜率變小。');
  await page.fill('#parameters', 'Vin=24 V, Vout=12 V, L=100 µH, fsw=100 kHz');
  await page.click('#commitPrediction');
  await expect(page.locator('#predictionStatus')).toContainText('preregistered');
  await page.fill('#observation', '漣波由1.2 A下降到0.6 A且仍維持三角波。');
  await page.fill('#explanation', '電感電流斜率由電感兩端電壓除以電感值決定所以L加倍時漣波約減半。');
  await page.fill('#limitations', '此判斷忽略電感直流電阻開關壓降與量測頻寬限制。');
  await page.fill('#transfer', '若開關頻率加倍而其他條件固定則預期漣波也約減半並需重新實測。');
  await page.click('#completeReport');
  await expect(page.locator('#reportMessage')).toContainText('完成');
  await page.reload();
  await expect(page.locator('#prediction')).toHaveValue(/增加L/);
  await expect(page.locator('#predictionStatus')).toContainText('preregistered');
});

test('quiz exposes misconception feedback and progress survives reload', async ({ page }) => {
  await page.goto('/quiz.html');
  const firstCard = page.locator('.quiz-card').first();
  const firstOption = firstCard.locator('.quiz-option').first();
  await firstOption.click();
  await expect(page.locator('.quiz-result').first()).not.toBeEmpty();
  await page.reload();
  await expect(page.locator('.quiz-card').first()).toBeVisible();
});

test('mobile pages do not overflow horizontally', async ({ page }) => {
  for (const path of ['/', '/beginner.html', '/report.html', '/quiz.html']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  }
});

test('core flow persists completion and resumes the next layer from home', async ({ page }) => {
  await page.goto('/19_c2000_buck_firmware_lab/');
  await page.evaluate(() => localStorage.removeItem('circuit-core-flow-v1'));
  await page.reload();

  await expect(page.locator('[data-core-layer-panel="physics"]')).toBeVisible();
  await page.locator('[data-physics-predict="lower"]').click();
  await page.locator('#inductanceRange').fill('250');
  const complete = page.locator('[data-core-footer="physics"] [data-core-complete]');
  await expect(complete).toBeEnabled();
  await complete.click();
  await expect(page.locator('[data-core-layer-panel="sensing"]')).toBeVisible();
  await expect(page.locator('[data-core-step="physics"]')).toHaveAttribute('data-complete', '1');

  await page.reload();
  await expect(page.locator('[data-core-layer-panel="sensing"]')).toBeVisible();
  await expect(page.locator('[data-layer-coach="sensing"]')).toHaveAttribute('data-answered', '0');

  await page.goto('/');
  await expect(page.locator('[data-core-resume]')).toHaveAttribute('href', '19_c2000_buck_firmware_lab/index.html?layer=sensing');
  await expect(page.locator('[data-journey-stage="physics"]')).toHaveClass(/is-complete/);
  await expect(page.locator('[data-journey-stage="sensing"]')).toHaveClass(/is-active/);
});
