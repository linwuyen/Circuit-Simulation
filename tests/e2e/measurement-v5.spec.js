const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('prediction commit precedes simulator and produces A-strength verified evidence', async ({ page }) => {
  await page.goto('/report.html?labId=buck.lab.buck-ripple');
  await page.locator('#prediction').fill('L增加時電流漣波會下降因為電感電流斜率變小。');
  await page.locator('#parameters').fill('Vin=12 V, Vout=3.3 V, L=12 µH, fsw=500 kHz, Iout=2 A');
  await page.locator('#commitPrediction').click();
  await expect(page.locator('#predictionStatus')).toContainText('preregistered');
  await page.locator('#openSimulator').click();
  await expect(page.locator('.clt-root')).toBeAttached();
  await page.locator('#ind').evaluate(el => { el.value = '12'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(500);
  await page.goto('/report.html?labId=buck.lab.buck-ripple');
  await expect(page.locator('#machineEvidence')).toContainText(/independent PASS [1-9]/);
  await page.locator('#observation').fill('ΔI約0.399 A，約為Iout=2 A的20%，且維持CCM。');
  await page.locator('#explanation').fill('由di/dt=vL/L與電感伏秒平衡可知ΔI和L及fsw成反比，所以提高L會降低漣波。');
  await page.locator('#limitations').fill('進入DCM、pulse skipping、電感DCR或MOSFET壓降不可忽略時，此理想CCM模型會失效。');
  await page.locator('#transfer').fill('若fsw加倍而其他條件不變，預期ΔI減半，並以新參數重新驗證。');
  await page.locator('#completeReport').click();
  await expect(page.locator('#reportMessage')).toContainText('Evidence strength A');
  await expect(page.locator('#reportMessage')).toContainText('Reasoning');
});

test('simulator-first workflow is explicitly marked post-hoc', async ({ page }) => {
  await page.goto('/0_buck_converter_/2_current_ripple.html');
  await expect(page.locator('.clt-root')).toBeAttached();
  await page.locator('#ind').evaluate(el => { el.value = '8'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(400);
  await page.goto('/report.html?labId=buck.lab.buck-ripple');
  await page.locator('#prediction').fill('L增加時電流漣波會下降。');
  await page.locator('#parameters').fill('Vin=12 V, Vout=3.3 V, L=8 µH, fsw=500 kHz');
  await page.locator('#commitPrediction').click();
  await expect(page.locator('#predictionStatus')).toContainText('事後補寫');
});

test('numeric open response is graded without multiple-choice recognition', async ({ page }) => {
  await page.goto('/quiz.html?module=buck');
  await page.locator('[data-numeric-answer="buck-open-inductance"]').fill('90');
  await page.locator('[data-numeric-submit="buck-open-inductance"]').click();
  await expect(page.locator('[data-numeric-result="buck-open-inductance"]')).toContainText('正確');
});

test('diagnostic game exposes entropy-derived information gain', async ({ page }) => {
  await page.goto('/troubleshooting.html');
  await page.locator('[data-game-test="spi-overrun-game"][data-test="fifo-level"]').click();
  await expect(page.locator('[data-game="spi-overrun-game"] .game-evidence')).toContainText('overflow flag');
  await expect(page.locator('[data-game="spi-overrun-game"] .game-evidence')).toContainText('bits');
  await page.locator('[data-game-cause="spi-overrun-game"][data-cause="fifo-service"]').click();
  await expect(page.locator('[data-game="spi-overrun-game"] .game-score')).toContainText('Root cause 正確');
});