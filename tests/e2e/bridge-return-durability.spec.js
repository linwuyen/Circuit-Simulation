const {test,expect}=require('@playwright/test');
const {resetEvidence}=require('./evidence-fixture');
test('return ticket completion and return navigation wait for durable save',async({page})=>{
 await page.goto('/15_power_capstone/lab_sandbox.html?learnFrom=core-sensing&remediation=unit');
 await resetEvidence(page);await page.reload();
 await page.waitForFunction(()=>window.CircuitLearningBridge);
 await page.evaluate(async()=>{CircuitUnifiedLearning.beginReturn('core-sensing','unit');await CircuitEvidence.flush();await new Promise(resolve=>navigator.locks.request(CircuitEvidence.KEY,()=>new Promise(release=>{window.releaseReturnLock=release;resolve();})));document.dispatchEvent(new CustomEvent('learning:remediation-passed',{detail:{category:'unit',miniCompleted:true,transferPassed:true,first:{correct:true},at:Date.now()}}));});
 const dock=page.locator('#learning-navigation');
 await expect(dock).toContainText('往返紀錄尚未儲存');await expect(dock).not.toContainText('補強新條件已通過。請返回');await expect(dock).not.toContainText('補強新條件題已通過');
 const current=page.url();await dock.getByRole('link',{name:/返回原任務/}).click();expect(page.url()).toBe(current);
 expect(await page.evaluate(()=>JSON.parse(CircuitEvidence.exportBackup()).benchmark.unifiedLearning.returnTask.passedAt)).toBeTruthy();
 await page.evaluate(()=>releaseReturnLock());await expect(dock).toContainText('補強新條件已通過。請返回');
 await dock.getByRole('link',{name:/返回原任務/}).click();await expect(page).not.toHaveURL(current);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('circuit-learning-state-v5')).benchmark.unifiedLearning.returnTask.passedAt)).toBeTruthy();
});
test('failed return ticket remains pending and exportable until successful retry',async({page})=>{
 await page.goto('/15_power_capstone/lab_sandbox.html?learnFrom=core-sensing&remediation=unit');await resetEvidence(page);await page.reload();await page.waitForFunction(()=>window.CircuitLearningBridge);
 await page.evaluate(async()=>{await CircuitEvidence.flush();const original=Storage.prototype.setItem;window.restoreReturnStorage=()=>{Storage.prototype.setItem=original;};Storage.prototype.setItem=function(k,v){if(k===CircuitEvidence.KEY)throw new DOMException('quota','QuotaExceededError');return original.call(this,k,v);};document.dispatchEvent(new CustomEvent('learning:remediation-passed',{detail:{category:'unit',miniCompleted:true,transferPassed:true,first:{correct:true},at:Date.now()}}));});
 const dock=page.locator('#learning-navigation');await expect(dock).toContainText('往返紀錄尚未儲存');await expect(dock).not.toContainText('補強新條件已通過。請返回');await expect(dock).not.toContainText('補強新條件題已通過');
 await expect.poll(()=>page.evaluate(()=>CircuitEvidence.storageStatus().reason)).toBe('QuotaExceededError');
 const current=page.url();await dock.getByRole('link',{name:/返回原任務/}).click();expect(page.url()).toBe(current);
 expect(await page.evaluate(()=>JSON.parse(CircuitEvidence.exportBackup()).benchmark.unifiedLearning.returnTask.passedAt)).toBeTruthy();
 await page.evaluate(()=>{restoreReturnStorage();CircuitEvidence.retrySave();});await expect(dock).toContainText('補強新條件已通過。請返回');
});
test('starting remediation saves the return ticket before leaving the map',async({page})=>{
 await page.goto('/map.html');await resetEvidence(page);await page.reload();await page.waitForFunction(()=>window.CircuitLearningBridge);
 await page.evaluate(async()=>{CircuitUnifiedLearning.beginReturn('core-sensing','unit');await CircuitEvidence.flush();CircuitLearningBridge.render();await new Promise(resolve=>navigator.locks.request(CircuitEvidence.KEY,()=>new Promise(release=>{window.releaseReturnLock=release;resolve();})));});
 await page.locator('[data-learning-hub] [data-unified-resume]').click();await expect(page).toHaveURL(/map.html$/);await expect(page.locator('#learning-navigation')).toContainText('往返紀錄尚未儲存');
 await page.evaluate(()=>releaseReturnLock());await expect(page).toHaveURL(/lab_sandbox.html\?remediation=unit&learnFrom=core-sensing/);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('circuit-learning-state-v5')).benchmark.unifiedLearning.returnTask.id)).toBe('core-sensing');
});
