const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('all labs expose explicit verification contracts and honest grade ceilings', async ({ page }) => {
  await page.goto('/labs.html');
  await expect(page.locator('#mainContent')).toContainText('38/38 labs classified');
  await expect(page.locator('#mainContent')).toContainText('12/12 modules have an A path');
  await expect(page.locator('#labGrid')).toContainText('Independent oracle · ceiling A');
  await expect(page.locator('#labGrid')).toContainText('Machine + reasoning contract · ceiling B');
  await expect(page.locator('#labGrid')).toContainText('不設假 oracle；此任務 ceiling B');
});

test('progress reports complete contract coverage without pretending all labs have ground truth', async ({ page }) => {
  await page.goto('/progress.html');
  await expect(page.locator('#labContractMatrix')).toContainText('38/38 classified');
  await expect(page.locator('#labContractMatrix')).toContainText('A-capable');
  await expect(page.locator('#labContractMatrix')).toContainText('ground truth');
  const moduleCards=page.locator('#labContractMatrix .lab');
  await expect(moduleCards).toHaveCount(12);
});

test('PI black-box oracle closes prediction to A-strength evidence', async ({ page }) => {
  await page.goto('/report.html?labId=pi.lab.pi-ki');
  await expect(page.locator('#v7ReportContract')).toContainText('ceiling A');
  await page.fill('#prediction','Ki增加時0dB交越頻率會提高，積分器增益曲線向上移。');
  await page.fill('#parameters','Ki=6000 1/s');
  await page.click('#commitPrediction');

  await page.goto('/4_PI/02_integrator.html');
  await expect(page.locator('.clt-root')).toBeAttached();
  await page.locator('#ki-slider').fill('6000');
  await page.waitForTimeout(500);

  await page.goto('/report.html?labId=pi.lab.pi-ki');
  await expect(page.locator('#machineEvidence')).toContainText('independent PASS 1');
  await page.fill('#observation','0dB crossing 約 955 Hz，與獨立計算相符。');
  await page.fill('#explanation','Ki/s 積分器的 0dB crossing 由 Ki/(2π) 決定，幅頻斜率為 -20 dB/decade，相位約 -90°。');
  await page.fill('#limitations','離散取樣、plant 動態與運算延遲會讓單純連續積分器模型出現限制。');
  await page.fill('#transfer','若 Ki 增加到 12000，其他條件相同時 0dB crossing 約加倍。');
  await page.fill('#nextStep','下一步量測實際 plant 與 delay 後再看 phase margin。');
  await page.click('#completeReport');
  await expect(page.locator('#reportMessage')).toContainText('Evidence strength A');
});

test('A-grade domain gate rejects generic fluent prose on a newly covered oracle', async ({ page }) => {
  await page.goto('/report.html?labId=pi.lab.pi-ki');
  await page.fill('#prediction','Ki增加所以結果會上升。');
  await page.fill('#parameters','Ki=6000 1/s');
  await page.click('#commitPrediction');
  await page.fill('#observation','結果是 955 Hz。');
  await page.fill('#explanation','因為月亮比較亮所以這個結果在工程上看起來很合理。');
  await page.fill('#limitations','香蕉與天氣可能造成一些限制。');
  await page.fill('#transfer','換到 Ki=12000 後再看看結果。');
  await page.fill('#nextStep','下一步再做一次量測。');
  await page.click('#completeReport');
  await expect(page.locator('#reportMessage')).toContainText('尚不能完成');
});