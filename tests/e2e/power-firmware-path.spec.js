const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('home exposes the six-layer Power Electronics Firmware Engineer path', async ({ page }) => {
  await expect(page.locator('#powerFirmwarePath')).toContainText('Power Electronics Firmware Engineer Path');
  await expect(page.locator('#powerFirmwarePath')).toContainText('Power Physics');
  await expect(page.locator('#powerFirmwarePath')).toContainText('System Integration');
  await expect(page.locator('a[href="13_power_sync/index.html"]')).toHaveCount(2);
  await expect(page.locator('a[href="14_power_protection/index.html"]')).toHaveCount(2);
  await expect(page.locator('a[href="15_power_capstone/index.html"]')).toHaveCount(2);
  await expect(page.locator('.v8-validity-summary')).toContainText('16/16 golden anchors pass');
  await expect(page.locator('.v8-validity-summary')).toContainText('16/16 modules anchored');
});

test('PWM ADC timing lab records independently verified same-cycle timing', async ({ page }) => {
  await page.goto('/13_power_sync/lab_timing.html');
  await expect(page.locator('.clt-root')).toBeAttached();
  await expect(page.locator('#sync-period')).toContainText('10000 ns');
  await expect(page.locator('#sync-margin')).toContainText('2950 ns');
  await page.locator('#sync-control').fill('1100');
  await page.waitForTimeout(700);
  await expect(page.locator('#sync-margin')).toContainText('2850 ns');
  const event=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('circuit-learning-state-v5')||'{}');const m=s.evidence&&s.evidence['power-sync.lab.timing']&&s.evidence['power-sync.lab.timing'].machine||[];return m.find(x=>x.verification&&x.verification.oracleVersion==='power-fw-1.0');});
  expect(event).toBeTruthy();expect(event.verification.passed).toBe(true);expect(event.verification.independentValidated).toBe(true);expect(event.verification.observableContract.labId).toBe('power-sync.lab.timing');
});

test('protection latency lab proves hardware path against independent reference', async ({ page }) => {
  await page.goto('/14_power_protection/lab_latency.html');
  await expect(page.locator('.clt-root')).toBeAttached();
  await expect(page.locator('#prot-hw')).toContainText('400 ns');
  await expect(page.locator('#prot-sw')).toContainText('5000 ns');
  await page.locator('#prot-filter').fill('220');
  await page.waitForTimeout(700);
  await expect(page.locator('#prot-hw')).toContainText('420 ns');
  const pass=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('circuit-learning-state-v5')||'{}');const m=s.evidence&&s.evidence['protection.lab.trip-latency']&&s.evidence['protection.lab.trip-latency'].machine||[];return m.some(x=>x.verification&&x.verification.passed&&x.verification.independentValidated);});
  expect(pass).toBe(true);
});

test('capstone budget keeps background work outside serial critical path', async ({ page }) => {
  await page.goto('/15_power_capstone/lab_budget.html');
  await expect(page.locator('.clt-root')).toBeAttached();
  await expect(page.locator('#cap-critical')).toContainText('4.00 us');
  await expect(page.locator('#cap-margin')).toContainText('6.00 us');
  await page.locator('#cap-background').fill('7');
  await page.waitForTimeout(700);
  await expect(page.locator('#cap-critical')).toContainText('4.00 us');
  const pass=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('circuit-learning-state-v5')||'{}');const m=s.evidence&&s.evidence['power-capstone.lab.integration-budget']&&s.evidence['power-capstone.lab.integration-budget'].machine||[];return m.some(x=>x.verification&&x.verification.passed);});
  expect(pass).toBe(true);
});

test('quiz and troubleshooting expose new transfer, numeric and Bayesian tasks', async ({ page }) => {
  await page.goto('/quiz.html?module=power-sync');
  await expect(page.locator('#mainContent')).toContainText('power-sync.sample-update.deadline');
  await expect(page.locator('[data-current-question]')).toHaveCount(1);
  await expect(page.locator('[data-numeric-answer="sync-open-margin"]')).toHaveCount(1);
  await expect(page.locator('[data-numeric-answer="sync-open-period"]')).toHaveCount(1);
  await page.goto('/troubleshooting.html');
  await expect(page.locator('#diagnosticGames .diagnostic-game')).toHaveCount(14);
  await expect(page.locator('[data-game="sync-deadline-game"]')).toHaveCount(1);
  await expect(page.locator('[data-game="protection-path-game"]')).toHaveCount(1);
  await expect(page.locator('[data-game="capstone-chain-game"]')).toHaveCount(1);
});

test('progress marks the three new core competencies independently verified', async ({ page }) => {
  await page.goto('/progress.html');
  await expect(page.locator('#engineeringCapabilityLadder')).toContainText('L7');
  await expect(page.locator('#externalAnchorMatrix + .fault-table .fault-row')).toHaveCount(16);
  for(const competency of ['power-sync.sample-update.deadline','protection.trip.latency','capstone.signal-chain.integration']){
    const row=page.locator('#coverageMatrix .fault-row').filter({hasText:competency});
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('verified');
  }
});

test('new system labs remain usable on mobile without horizontal document overflow', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  for(const path of ['/13_power_sync/lab_timing.html','/14_power_protection/lab_latency.html','/15_power_capstone/lab_budget.html']){
    await page.goto(path);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  }
});
