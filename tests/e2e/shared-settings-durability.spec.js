const {test,expect}=require('@playwright/test');
const {resetEvidence}=require('./evidence-fixture');
for(const source of ['case','sandbox']){
 const route=source==='case'?'/learning-case.html':'/15_power_capstone/lab_sandbox.html';
 const button=source==='case'?'#case-save':'#shared-settings button:first-of-type';
 const status=source==='case'?'#case-storage':'#shared-settings [role=status]';
 test(`${source} shared settings reports durable success only after lock release`,async({page})=>{
  await page.goto(route);await resetEvidence(page);await page.reload();await expect(page.locator(button)).toBeVisible();
  await page.evaluate(async()=>{await CircuitEvidence.flush();await new Promise(resolve=>navigator.locks.request(CircuitEvidence.KEY,()=>new Promise(release=>{window.releaseSharedLock=release;resolve();})));});
  await page.click(button);await expect(page.locator(status)).toContainText('尚未儲存');await expect(page.locator(button)).toBeDisabled();
  if(source==='case')await expect(page.locator('[data-control]').first()).toBeDisabled();
  const before=page.url();await page.locator(source==='case'?'#case-save + button + a':'#shared-settings > a').click();expect(page.url()).toBe(before);
  await page.evaluate(()=>releaseSharedLock());await expect(page.locator(status)).toContainText('已保存');await expect(page.locator(button)).toBeEnabled();
  await page.reload();expect(await page.evaluate(()=>CircuitUnifiedLearning.read().scenarios['buck-steady-v1'].model.vin)).toBe(48);
 });
 test(`${source} shared settings quota failure remains exportable and retry recovers`,async({page})=>{
  await page.goto(route);await resetEvidence(page);await page.reload();await expect(page.locator(button)).toBeVisible();
  await page.evaluate(async()=>{await CircuitEvidence.flush();const original=Storage.prototype.setItem;window.restoreSharedStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(k,v){if(k===CircuitEvidence.KEY)throw new DOMException('quota','QuotaExceededError');return original.call(this,k,v);};});
  await page.click(button);await expect(page.locator(status)).toContainText('未儲存');await expect(page.locator(status)).not.toContainText('已保存');
  expect(await page.evaluate(()=>JSON.parse(CircuitEvidence.exportBackup()).benchmark.unifiedLearning.scenarios['buck-steady-v1'].model.vin)).toBe(48);
  await page.evaluate(()=>{restoreSharedStorage();CircuitEvidence.retrySave();});await expect(page.locator(status)).toContainText('已保存');await expect(page.locator(button)).toBeEnabled();
 });
}
test('sandbox cannot publish old settings while an imported experiment is still being read',async({page})=>{
 await page.goto('/15_power_capstone/lab_sandbox.html');await resetEvidence(page);await page.reload();await expect(page.locator('#shared-settings')).toBeVisible();
 await page.evaluate(()=>{const original=CircuitTrainingRecords.readFile;window.sharedImportReads=0;CircuitTrainingRecords.readFile=async file=>{sharedImportReads++;await new Promise(resolve=>window.releaseSharedImport=resolve);return original(file);};});
 const record=await page.evaluate(()=>CircuitTrainingExperiments.createExperiment({vin:36},{}));
 await page.locator('#tr-import').setInputFiles({name:'experiment.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(record))});
 await page.locator('#tr-import').dispatchEvent('change');expect(await page.evaluate(()=>sharedImportReads)).toBe(1);await expect(page.locator('#tr-import')).toBeDisabled();
 await page.getByRole('button',{name:'保存目前電路為共用設定'}).click();await expect(page.locator('#shared-settings [role=status]')).toContainText('匯入尚未完成');
 expect(await page.evaluate(()=>CircuitUnifiedLearning.read().scenarios?.['buck-steady-v1'])).toBeUndefined();
 await page.evaluate(()=>releaseSharedImport());await expect(page.locator('#tr-replay-status')).toContainText('匯入完成');await page.getByRole('button',{name:'保存目前電路為共用設定'}).click();await expect(page.locator('#shared-settings [role=status]')).toContainText('已保存');
 expect(await page.evaluate(()=>CircuitUnifiedLearning.read().scenarios['buck-steady-v1'].model.vin)).toBe(36);
});
