const {test,expect}=require('@playwright/test');
async function bare(page){await page.goto('/tests/');await page.addScriptTag({url:'/assets/learning/learning-evidence.js'});}
test('same-version concurrent writers serialize, loser retains export and retry cannot overwrite',async({page,context})=>{
 await bare(page);await page.evaluate(async()=>{CircuitEvidence.save(CircuitEvidence.load());await CircuitEvidence.flush();});
 const other=await context.newPage();await bare(other);
 for(const p of [page,other])await p.evaluate(()=>{window.draft=CircuitEvidence.load();});
 const holder=await context.newPage();await bare(holder);
 await holder.evaluate(()=>{window.held=false;navigator.locks.request(CircuitEvidence.KEY,()=>new Promise(resolve=>{window.release=resolve;window.held=true;}));});
 await expect.poll(()=>holder.evaluate(()=>held)).toBe(true);
 await page.evaluate(()=>{draft.evidence.alpha={level:1};CircuitEvidence.save(draft);});
 await other.evaluate(()=>{draft.evidence.beta={level:2};CircuitEvidence.save(draft);});
 expect(await page.evaluate(()=>CircuitEvidence.storageStatus().saved)).toBe(false);
 await holder.evaluate(()=>release());await page.evaluate(()=>CircuitEvidence.flush());await other.evaluate(()=>CircuitEvidence.flush());
 const statuses=await Promise.all([page,other].map(p=>p.evaluate(()=>CircuitEvidence.storageStatus())));expect(statuses.filter(s=>s.saved)).toHaveLength(1);
 const loser=statuses[0].saved?other:page,winner=statuses[0].saved?page:other;
 const durable=await winner.evaluate(()=>localStorage.getItem(CircuitEvidence.KEY));
 await expect(loser.locator('#learning-storage-status')).toContainText('紀錄已衝突');
 expect(await loser.evaluate(()=>CircuitEvidence.exportBackup())).toContain(statuses[0].saved?'beta':'alpha');
 await loser.evaluate(async()=>{CircuitEvidence.retrySave();await CircuitEvidence.flush();});
 expect(await winner.evaluate(()=>localStorage.getItem(CircuitEvidence.KEY))).toBe(durable);
});
test('queued same-tab changes and export retain all evidence before commit',async({page,context})=>{
 await bare(page);await page.evaluate(async()=>{CircuitEvidence.load();await CircuitEvidence.flush();});
 const holder=await context.newPage();await bare(holder);await holder.evaluate(()=>{window.held=false;navigator.locks.request(CircuitEvidence.KEY,()=>new Promise(resolve=>{window.release=resolve;window.held=true;}));});await expect.poll(()=>holder.evaluate(()=>held)).toBe(true);
 await page.evaluate(()=>{CircuitEvidence.recordEvidence('one',1,'test');CircuitEvidence.recordEvidence('two',2,'test');});
 const backup=JSON.parse(await page.evaluate(()=>CircuitEvidence.exportBackup()));expect(backup.evidence.one.level).toBe(1);expect(backup.evidence.two.level).toBe(2);
 await expect(page.locator('#learning-storage-status')).toBeVisible();await holder.evaluate(()=>release());expect((await page.evaluate(()=>CircuitEvidence.flush())).saved).toBe(true);
 await page.reload();await page.addScriptTag({url:'/assets/learning/learning-evidence.js'});expect(await page.evaluate(()=>CircuitEvidence.load().evidence.two.level)).toBe(2);
});
