const { test, expect } = require('@playwright/test');

test('homepage keeps causal journey ahead of outcome dashboards', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.journey-shell')).toBeVisible();
  await expect(page.locator('[data-outcome-home]')).toBeAttached();
  const nested = await page.locator('[data-outcome-home]').evaluate(node => Boolean(node.closest('.journey-advanced-evidence')));
  expect(nested).toBe(true);
});

test('timing live view extends beyond one PWM period after a missed shadow load', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-stage-id="timing"]').click();
  const compute = page.locator('[data-timing-compute]');
  await compute.evaluate(el => {
    el.value = '8.8';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('[data-timing-deadline]')).toContainText('MISS');
  await expect(page.locator('[data-timing-horizon]')).toContainText('20.0 µs');
  await expect(page.locator('[data-timing-track] [data-load-marker]')).toHaveCount(2);
  const writeLeft = await page.locator('[data-event="write"]').evaluate(el => parseFloat(el.style.left));
  expect(writeLeft).toBeGreaterThan(50);
  expect(writeLeft).toBeLessThan(100);
});

test('topology and protection views expose their fidelity boundaries', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-stage-id="dynamics"]').click();
  await expect(page.locator('[data-bode-band]')).toContainText('1 Hz');

  // Topology preview is selected through the dynamics stage's transfer atlas button state.
  // The live topology stage is mounted at data-power-stage=5 even though it is not a core journey card.
  await page.evaluate(() => window.CircuitPowerSystemStateV1.set('ui.activeStage', 5, { source: 'e2e' }));
  await expect(page.locator('[data-power-stage="5"]')).toBeVisible();
  await expect(page.locator('[data-topology-model]')).toContainText('qualitative normalized signature');

  await page.locator('[data-stage-id="safety"]').click();
  await expect(page.locator('[data-protect-hw-time]')).toContainText('measure');
  await expect(page.locator('[data-power-stage="6"] .power-boundary')).toContainText('不再宣稱虛構的固定 hardware µs');
});
