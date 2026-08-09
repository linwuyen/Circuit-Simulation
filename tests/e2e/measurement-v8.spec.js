const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('FOC now has an official seeded transfer and retention family', async ({ page }) => {
  await page.goto('/quiz.html?module=foc');
  await expect(page.locator('#mainContent')).toContainText('foc.park.frame');
  await expect(page.locator('#mainContent')).toContainText('Park');
  await expect(page.locator('[data-current-question]')).toHaveCount(1);
  await expect(page.locator('#adaptiveV8')).toContainText('Adaptive next actions');
});

test('Bayesian diagnostic coverage expands to ten real engineering scenarios', async ({ page }) => {
  await page.goto('/troubleshooting.html');
  await expect(page.locator('#diagnosticGames .diagnostic-game')).toHaveCount(10);
  await expect(page.locator('#diagnosticCoverageV8')).toContainText('10 Bayesian cases');
  const game = page.locator('[data-game="foc-angle-game"]');
  await game.locator('[data-test="lock-rotor"]').click();
  await expect(game.locator('.game-evidence')).toContainText('IG');
  await game.locator('[data-cause="angle-offset"]').click();
  await expect(game.locator('.game-score')).toContainText('Root cause 正確');
});

test('progress exposes 12 external anchors, adaptive evidence labels and V8 verified coverage', async ({ page }) => {
  await page.goto('/progress.html');
  await expect(page.locator('.v8-validity-summary')).toContainText('12/12 golden anchors pass');
  await expect(page.locator('#externalAnchorMatrix + .fault-table .fault-row')).toHaveCount(12);
  await expect(page.locator('#adaptiveV8')).toContainText('Psychometric evidence');
  const foc = page.locator('#coverageMatrix .fault-row').filter({ hasText: 'foc.park.frame' });
  await expect(foc).toHaveCount(1);
  await expect(foc).toContainText('verified');
});

test('lesson Tutor writes typed observable provenance into independent oracle evidence', async ({ page }) => {
  await page.goto('/4_PI/02_integrator.html');
  await expect(page.locator('.clt-root')).toBeAttached();
  await page.locator('#ki-slider').fill('6000');
  await page.waitForTimeout(700);
  const evidence = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('circuit-learning-state-v5') || '{}');
    return (state.evidence && state.evidence['pi.lab.pi-ki'] && state.evidence['pi.lab.pi-ki'].machine) || [];
  });
  const typed = evidence.find(event => event.verification && event.verification.observableContract);
  expect(typed).toBeTruthy();
  expect(typed.verification.passed).toBe(true);
  expect(typed.verification.observableContract.version).toBe('1.0.0');
  expect(typed.verification.observableContract.labId).toBe('pi.lab.pi-ki');
});

test('V8 open-response tasks are available outside the original three benchmark modules', async ({ page }) => {
  await page.goto('/quiz.html?module=pi');
  await expect(page.locator('#mainContent')).toContainText('pi-open-crossover');
  await expect(page.locator('#mainContent')).toContainText('0 dB crossover');
});
