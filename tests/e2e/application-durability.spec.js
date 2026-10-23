const {test,expect}=require('@playwright/test');
async function answer(page,value){await page.locator(`input[name=application-answer][value=${value}]`).check();await page.locator('#application-submit').click();}
test('application completion cannot precede its durable record',async({page})=>{
 await page.goto('/17_power_topology_control/');await page.locator('#application-prepare').click();await answer(page,'lower');await page.locator('#application-run').click();await answer(page,'lower');
 await page.evaluate(async()=>{await CircuitEvidence.flush();await new Promise(resolve=>navigator.locks.request(CircuitEvidence.KEY,()=>new Promise(release=>{window.releaseApplicationLock=release;resolve();})));});
 await answer(page,'reason');
 await expect(page.locator('#application-next')).toHaveCount(0);
 await expect(page.locator('#application-submit')).toBeDisabled();
 await expect(page.locator('#application-progress')).toContainText('0 / 4');
 await page.evaluate(()=>releaseApplicationLock());
 await expect(page.locator('#application-next')).toBeVisible();await page.reload();await expect(page.locator('#application-next')).toBeVisible();
});
test('application storage failure preserves export and recovers only after retry',async({page})=>{
 await page.goto('/17_power_topology_control/');
 await page.evaluate(async()=>{await CircuitEvidence.flush();window.applicationSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===CircuitEvidence.KEY)throw new DOMException('full','QuotaExceededError');return applicationSetItem.call(this,key,value);};});
 await page.locator('#application-prepare').click();
 await expect(page.locator('#application-status')).toContainText('尚未接受');
 await expect(page.locator('#application-submit')).toBeDisabled();
 await expect(page.locator('#learning-storage-status button').first()).toBeEnabled();
 await page.evaluate(()=>document.getElementById('learning-storage-status').addEventListener('click',event=>{if(event.target.textContent==='重試儲存')Storage.prototype.setItem=applicationSetItem;},{capture:true,once:true}));
 await page.locator('#learning-storage-status').getByRole('button',{name:'重試儲存'}).click();
 await expect(page.locator('#application-submit')).toBeEnabled();await page.reload();await expect(page.locator('#application-submit')).toBeEnabled();
});
