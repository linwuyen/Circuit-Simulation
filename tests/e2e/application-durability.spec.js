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
test('lesson switch reload boundary under held lock',async({page,context})=>{
 await page.goto('/17_power_topology_control/?lesson=llc#guided-applications');
 await page.locator('#application-prepare').click();
 await expect(page.locator('#application-status')).toHaveText('原工具已套用起始條件。');
 const holder=await context.newPage();await holder.goto('/map.html');
 await holder.evaluate(async()=>{await new Promise(resolve=>navigator.locks.request(CircuitEvidence.KEY,()=>new Promise(release=>{window.releaseSwitchLock=release;resolve();})));});
 await page.locator('#guided-applications > nav button').first().click();
 await expect(page).toHaveURL(/lesson=pfc/);
 // A changed URL is not acceptance: the persisted lesson and selected navigation stay LLC.
 await expect(page.locator('#application-status')).toContainText('尚未接受');
 const first=page.locator('#guided-applications > nav button').first();
 await expect(first).toBeDisabled();await expect(first).toHaveAttribute('aria-current','false');
 expect(await holder.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.topologyApplications.currentLesson)).toBe('llc');
 await holder.evaluate(()=>releaseSwitchLock());
 await expect(first).toHaveAttribute('aria-current','step');await expect(first).toBeEnabled();
 await page.reload();
 await expect(page.locator('#guided-applications > nav button').first()).toHaveAttribute('aria-current','step');
 expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.topologyApplications.currentLesson)).toBe('pfc');
});
