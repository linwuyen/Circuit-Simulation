const { test, expect } = require('@playwright/test');

test('Buck physics workbench exposes transient and CCM/DCM regime transfer', async ({ page }) => {
  await page.goto('/learn.html#ti-buck-physics');
  await expect(page.locator('#surface-title')).toContainText('Buck Physics Workbench');
  await expect(page.locator('#ws-title')).toContainText('CCM');

  const load = page.getByLabel('R');
  await load.evaluate(el => {
    el.value = '100';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#ws-title')).toContainText('DCM');

  await page.getByRole('button', { name: 'Load sweep / regime' }).click();
  await expect(page.locator('#ws-comparison')).toContainText('boundary');
  await expect(page.locator('#ws-plot .ti-boundary-line')).toBeVisible();

  await page.getByRole('button', { name: 'Startup / full transient' }).click();
  await expect(page.locator('#ws-plot .ti-trace-vout')).toBeVisible();
  await expect(page.locator('#ws-plot .ti-trace-il')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});
