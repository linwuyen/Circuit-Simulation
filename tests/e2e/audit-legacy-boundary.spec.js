const {test,expect}=require('@playwright/test');
for(const route of ['/7.28388d_bms_tutorial/legacy/tms320f28388d_bms.html','/5_spi/originals/spi_fifo.original.html','/6.10μs 高頻控制迴路模擬器/10μs 高頻控制迴路模擬器.html']){
 test(`legacy direct route presents honest boundary and working return: ${route}`,async({page})=>{
  await page.goto(route);
  const boundary=page.locator('[data-legacy-boundary]');
  await expect(boundary).toBeVisible();
  await expect(boundary).toContainText('未經本次模型回歸驗證');
  const link=page.locator('[data-current-course]');
  await link.click();
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('[data-legacy-boundary]')).toHaveCount(0);
 });
}
