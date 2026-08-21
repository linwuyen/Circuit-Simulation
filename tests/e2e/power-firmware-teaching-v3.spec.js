const { test, expect } = require('@playwright/test');

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

const selectStage = async (page, id) => {
  await page.locator(`[data-stage-id="${id}"]`).click();
};

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('V3 connects switching physics, semantic C2000 timing, PCM, protection and production firmware', async ({ page }) => {
  await expect(page.locator('[data-v3-switching]')).toBeVisible();
  await setRange(page, '[data-v3-deadtime]', 300);
  await expect(page.locator('[data-v3-deadtime-out]')).toHaveText('300 ns');

  await selectStage(page, 'sensing');
  await expect(page.locator('[data-v3-calibration]')).toBeVisible();
  await setRange(page, '[data-v3-temp]', 100);
  await expect(page.locator('[data-v3-cal-drift]')).not.toHaveText('0.00%');

  await selectStage(page, 'timing');
  await expect(page.locator('[data-v3-c2000]')).toBeVisible();
  await expect(page.locator('[data-v3-pipeline]')).toContainText('CMPSS');
  await expect(page.locator('[data-v3-period-cycles]')).toContainText('2000');

  await selectStage(page, 'control');
  await page.evaluate(() => {
    CircuitPowerSystemStateV1.set('plant.duty', .7);
    CircuitPowerSystemStateV1.set('peakCurrent.slopeCompRatio', 0);
  });
  await expect(page.locator('[data-v3-pcm-verdict]')).toHaveText('SUBHARMONIC RISK');
  await setRange(page, '[data-v3-slope]', .5);
  await expect(page.locator('[data-v3-pcm-verdict]')).toHaveText('STABLE');

  await selectStage(page, 'dynamics');
  await expect(page.locator('[data-v3-model-grid] article')).toHaveCount(4);

  const transferAtlas = page.locator('.journey-specialization-links a[href="17_power_topology_control/index.html"]');
  await expect(transferAtlas).toBeVisible();
  await expect(transferAtlas).toContainText('Transfer Atlas');

  await selectStage(page, 'safety');
  await expect(page.locator('[data-v3-policy]')).toContainText('SCP');
  await expect(page.locator('[data-v3-policy]')).toContainText('Sensor implausible');

  await selectStage(page, 'production');
  await expect(page.locator('[data-v3-production]')).toBeVisible();
  await setRange(page, '[data-v3-power]', -800);
  await expect(page.locator('[data-v3-bi-mode]')).toHaveText('SINK / REGEN');
  await page.locator('[data-v3-age-command]').click();
  await page.locator('[data-v3-age-command]').click();
  await expect(page.locator('[data-v3-command-fresh]')).toHaveText('STALE');
  await expect(page.locator('[data-v3-prod-policy]')).toContainText('FAIL SAFE');
});

test('V3 stays within viewport on desktop and mobile', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    for (const id of ['energy','sensing','control','timing','dynamics','safety','production','capstone']) {
      await selectStage(page, id);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(2);
    }
  }
});
