const { test, expect } = require('@playwright/test');
test('digital control workbench separates Bode SFRA and switched timing evidence', async ({ page }) => {
  await page.goto('/learn.html#ti-control');
  await expect(page.locator('#surface-title')).toContainText('Digital Control');

  await page.getByRole('button',{name:'SFRA model vs measurement'}).click();
  await expect(page.locator('#ws-comparison')).toContainText('LINEAR_TEACHING_RANGE');

  const inj=page.locator('.ti-control-controls label').filter({hasText:'SFRA inj'}).locator('input');
  await inj.evaluate(el=>{el.value='.2';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect(page.locator('#ws-comparison')).toContainText(/SATURATION|LINEAR/);

  await page.getByRole('button',{name:'Switched transient'}).click();
  await expect(page.locator('#ws-comparison')).toContainText('PWM commit misses');

  await page.getByRole('button',{name:'Bode / margin'}).click();
  await expect(page.locator('#ws-comparison')).toContainText('PM');
});
