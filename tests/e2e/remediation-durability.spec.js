const {test,expect}=require('@playwright/test');
const {resetEvidence}=require('./evidence-fixture');
async function setup(page){await page.goto('/15_power_capstone/lab_sandbox.html');await resetEvidence(page);await page.reload();await page.locator('#training-remediation > summary').click();await page.selectOption('#tr-remediation-kind','unit');await page.click('#tr-question-new');await page.evaluate(()=>CircuitEvidence.flush());}
async function hold(page){await page.evaluate(async()=>{await CircuitEvidence.flush();await new Promise(resolve=>navigator.locks.request(CircuitEvidence.KEY,()=>new Promise(release=>{window.releaseAuditLock=release;resolve();})));});}
test('first remediation feedback and pilot submission wait for durable acceptance',async({page})=>{
 await setup(page);await page.fill('#tr-answer-controls input','1');await hold(page);await page.click('#tr-answer');
 await expect(page.locator('#tr-feedback')).toContainText('尚未接受');
 await expect(page.locator('#tr-mini')).toBeDisabled();await expect(page.locator('#pilot-summary')).not.toContainText('本機已提交 0 個維修案例、1');
 await page.evaluate(()=>releaseAuditLock());await expect(page.locator('#tr-feedback')).toContainText('單位換算');await expect(page.locator('#tr-mini')).toBeEnabled();
 await expect(page.locator('#pilot-summary')).toContainText('本機已提交 0 個維修案例、1');
});
test('quota failure cannot reveal transfer pass or dispatch accepted remediation event; backup remains available',async({page})=>{
 await setup(page);await page.fill('#tr-answer-controls input','1');await page.click('#tr-answer');await expect(page.locator('#tr-feedback')).toContainText('單位換算');await page.click('#tr-mini');await expect(page.locator('#tr-transfer-answer')).toBeEnabled();
 const prompt=await page.locator('#tr-transfer-question').innerText();const uh=Number(prompt.match(/([\d.]+) µH/)[1]);await page.fill('#tr-transfer-controls input',String(uh*1e-6));
 await page.evaluate(async()=>{await CircuitEvidence.flush();window.accepted=0;document.addEventListener('learning:remediation-passed',()=>accepted++);const original=Storage.prototype.setItem;window.originalAuditSetItem=original;Storage.prototype.setItem=function(k,v){if(k===CircuitEvidence.KEY)throw new DOMException('Quota','QuotaExceededError');return original.call(this,k,v);};});
 await page.click('#tr-transfer-answer');await expect(page.locator('#tr-transfer-result')).toContainText('未被接受');await expect(page.locator('#tr-transfer-result')).not.toContainText('驗證通過');expect(await page.evaluate(()=>accepted)).toBe(0);
 const draft=await page.evaluate(()=>JSON.parse(CircuitEvidence.exportBackup()));expect(draft.benchmark.trainingPractice.sessions.some(s=>s.transferPassed)).toBe(true);
 const download=page.waitForEvent('download');await page.locator('#learning-storage-status').getByRole('button',{name:'匯出備份'}).click();await download;
 await page.evaluate(()=>{Storage.prototype.setItem=originalAuditSetItem;CircuitEvidence.retrySave();});
 await expect(page.locator('#tr-transfer-result')).toContainText('驗證通過');expect(await page.evaluate(()=>accepted)).toBe(1);await expect(page.locator('#tr-question-new')).toBeEnabled();
});
test('parameter durability message cannot claim saved while lock is held',async({page})=>{
 await setup(page);await hold(page);await page.fill('#tr-load','100');await page.locator('#tr-load').blur();
 await expect(page.locator('#tr-replay-status')).toContainText('尚未儲存');
 await expect(page.locator('#tr-replay-status')).not.toContainText('已保存參數');
 await page.evaluate(()=>releaseAuditLock());await expect(page.locator('#tr-replay-status')).toContainText('已保存參數操作');
});
test('mini experiment reveals transfer prompt only after its record is durable',async({page})=>{
 await setup(page);await page.fill('#tr-answer-controls input','1');await page.click('#tr-answer');await expect(page.locator('#tr-mini')).toBeEnabled();
 await hold(page);await page.click('#tr-mini');await expect(page.locator('#tr-mini-result')).toContainText('尚未接受');await expect(page.locator('#tr-transfer-question')).toBeEmpty();await expect(page.locator('#tr-transfer-answer')).toBeDisabled();
 await page.evaluate(()=>releaseAuditLock());await expect(page.locator('#tr-transfer-answer')).toBeEnabled();await expect(page.locator('#tr-transfer-question')).toContainText('µH');
});
