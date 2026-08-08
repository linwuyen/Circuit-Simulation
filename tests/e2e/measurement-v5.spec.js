const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('prediction commit precedes simulator and produces A-strength verified evidence', async ({ page }) => {
  await page.goto('/report.html?labId=buck.lab.buck-ripple');
  await page.locator('#prediction').fill('L 增加，電流漣波下降');
  await page.locator('#parameters').fill('Vin=12 V, Vout=3.3 V, L=12 µH, fsw=500 kHz, Iout=2 A');
  await page.locator('#commitPrediction').click();
  await expect(page.locator('#predictionStatus')).toContainText('preregistered');

  await page.locator('#openSimulator').click();
  await expect(page.locator('.clt-root')).toBeAttached();
  await page.locator('#ind').evaluate(el => { el.value = '12'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(500);

  await page.goto('/report.html?labId=buck.lab.buck-ripple');
  await expect(page.locator('#machineEvidence')).toContainText(/structured pass [1-9]/);
  await page.locator('#observation').fill('ΔI 約 0.399 A，約為 2 A 負載的 20%，工作模式維持 CCM。');
  await page.locator('#explanation').fill('由電感伏秒平衡，ΔI 與 L 及 fsw 成反比，所以提高 L 會降低三角波漣波。');
  await page.locator('#limitations').fill('忽略 MOSFET 壓降、電感 DCR 與控制器 pulse skipping，進 DCM 後此 CCM 模型失效。');
  await page.locator('#transfer').fill('若 fsw 加倍而其他條件不變，預期 ΔI 約再減半，需用新參數重新驗證。');
  await page.locator('#completeReport').click();
  await expect(page.locator('#reportMessage')).toContainText('Evidence strength A');
});

test('simulator-first workflow is explicitly marked post-hoc', async ({ page }) => {
  await page.goto('/0_buck_converter_/2_current_ripple.html');
  await expect(page.locator('.clt-root')).toBeAttached();
  await page.locator('#ind').evaluate(el => { el.value = '8'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(400);
  await page.goto('/report.html?labId=buck.lab.buck-ripple');
  await page.locator('#prediction').fill('L 增加，電流漣波下降');
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

test('diagnostic game scores information-efficient root cause testing', async ({ page }) => {
  await page.goto('/troubleshooting.html');
  await page.locator('[data-game-test="spi-overrun-game"][data-test="fifo-level"]').click();
  await expect(page.locator('[data-game="spi-overrun-game"] .game-evidence')).toContainText('overflow flag');
  await page.locator('[data-game-cause="spi-overrun-game"][data-cause="fifo-service"]').click();
  await expect(page.locator('[data-game="spi-overrun-game"] .game-score')).toContainText('Root cause 正確');
});