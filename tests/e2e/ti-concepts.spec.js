const { test, expect } = require('@playwright/test');

test('TI concept catalog exposes all 15 cards and concept evidence stays locked until prediction', async ({ page }) => {
  await page.goto('/learn.html#ti-concepts');
  await expect(page.locator('.ti-concept-card')).toHaveCount(15);

  await page.goto('/learn.html#ti-concept/boost-rhpz');
  await expect(page.locator('#ws-title')).toContainText('duty');
  await expect(page.locator('#ws-plot')).toBeHidden();

  await page.locator('input[name="ti-concept-predict"][value="dip"]').check();
  await page.getByRole('button', { name: 'Lock prediction → reveal evidence' }).click();

  await expect(page.locator('#ws-plot')).toBeVisible();
  await expect(page.locator('#surface-help')).toContainText('rhpzHz');
  const saved = await page.evaluate(() => {
    const s=CircuitEvidence.load();
    return {
      prediction:!!s.predictions['ti-concept:boost-rhpz'],
      evidence:s.evidence['ti-concept:boost-rhpz']?.level||0
    };
  });
  expect(saved.prediction).toBe(true);
  expect(saved.evidence).toBeGreaterThanOrEqual(2);
});
