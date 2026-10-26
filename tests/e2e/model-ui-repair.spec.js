const {test,expect}=require('@playwright/test');
test('sandbox invalid edits clear results without saving valid evidence and recover',async({page})=>{
 await page.goto('/15_power_capstone/lab_sandbox.html');
 const before=await page.evaluate(async()=>{await CircuitEvidence.flush();return JSON.stringify(CircuitEvidence.load());});
 for(const value of ['0','','-1']){
  await page.getByLabel('電感 L（µH）',{exact:true}).fill(value);
  await expect(page.locator('#sb-status')).toHaveClass(/fail/);
  await expect(page.locator('#sb-final-v')).toHaveText('—');
  expect(await page.evaluate(async()=>{await CircuitEvidence.flush();return JSON.stringify(CircuitEvidence.load());})).toBe(before);
 }
 await page.getByLabel('電感 L（µH）',{exact:true}).fill('500');await expect(page.locator('#sb-state')).toHaveText('RUN');
 await page.locator('#sb-vref').fill('40');await page.getByRole('button',{name:'還原本頁實驗設定',exact:true}).click();
 await expect(page.locator('#sb-vref')).toHaveValue('48');await expect(page.locator('#sb-input-status')).toContainText('紀錄保留');
});
test('AFE controls have names, wrap on mobile and paused reset updates all readouts',async({page},info)=>{
 await page.goto('/9.afe-tutorial/afe.html');
 await expect(page.getByLabel('直流端負載功率（W）',{exact:true})).toHaveValue('1000');
 await page.getByLabel('直流端負載功率（W）',{exact:true}).focus();await page.keyboard.press('ArrowRight');
 await expect(page.locator('#slide-load')).toHaveValue('1100');
 await page.locator('#slide-load').fill('900');
 await page.locator('#btn-pause').click();await page.locator('#btn-reset').click();
 await expect(page.locator('#stat-vbus')).toHaveText('380.0');
 await expect(page.locator('#slide-load')).toHaveValue('900');
 await expect(page.locator('#stat-pf')).toHaveText('0.000');
 await expect(page.locator('#afe-runtime-status')).toContainText('已暫停');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.getByRole('img',{name:'電網電壓、實際電流、電流命令、PLL相位與母線電壓'})).toBeVisible();
 await page.screenshot({path:info.outputPath('afe-after.png'),fullPage:true});
 await page.getByRole('link',{name:'返回 AFE 教材',exact:true}).click();await expect(page).toHaveURL(/9\.afe-tutorial\/index\.html/);
});
test('sandbox failed persistence is visible beside results rather than silently claiming saved',async({page})=>{
 await page.goto('/15_power_capstone/lab_sandbox.html');
 await page.evaluate(async()=>{await CircuitEvidence.flush();Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError');};});
 await page.locator('#sb-vref').fill('45');
 await expect(page.locator('#sb-save-status')).toContainText('尚未儲存');
});
