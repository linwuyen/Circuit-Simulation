const {test,expect}=require('@playwright/test');
const future={version:99,rows:{future:{answer:'keep me'}},history:[{future:true}],completed:true};
test('direct experiment entry preserves unsupported records and offers the record page',async({page})=>{
 await page.goto('/map.html');await page.waitForSelector('#workspace-learning-records');
 await page.evaluate(record=>{const e=CircuitEvidence.load();e.benchmark.learningWorkspace={version:1,experiment:record};CircuitEvidence.save(e);},future);
 await page.goto('/index.html#experiment-energy');
 expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.experiment)).toEqual(future);
 await expect(page.locator('#experiment-record-protection')).toBeVisible();
 await expect(page.locator('#experiment-record-protection a')).toHaveAttribute('href','map.html');
 await page.reload();expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.experiment)).toEqual(future);
 await page.locator('#experiment-record-protection a').click();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'下載全部學習進度備份'}).click();const download=await downloadPromise;
 const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);
 expect(Buffer.concat(chunks).toString()).toContain('keep me');
 expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.experiment)).toEqual(future);
});
test('another tab pauses an open experiment before further editing',async({page,context})=>{
 await page.goto('/index.html#experiment-energy');await expect(page.locator('#workspace-submit')).toBeVisible();
 const other=await context.newPage();await other.goto('/map.html');await other.waitForSelector('#workspace-learning-records');
 await other.evaluate(record=>{const e=CircuitEvidence.load();e.benchmark.learningWorkspace.experiment=record;CircuitEvidence.save(e);},future);
 await expect(page.locator('#experiment-record-protection')).toBeVisible();await expect(page.locator('main')).toBeHidden();
 expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.experiment)).toEqual(future);
});
test('an open experiment cannot overwrite an unsupported record saved later',async({page})=>{
 await page.goto('/index.html#experiment-energy');await page.locator('#ws-question input').first().check();await page.locator('#ws-question button').click();await expect(page.locator('#experiment-run')).toBeVisible();
 await page.evaluate(record=>{const e=CircuitEvidence.load();e.benchmark.learningWorkspace.experiment=record;CircuitEvidence.save(e);},future);
 await page.locator('#experiment-run').click();
 expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.experiment)).toEqual(future);
 await expect(page.locator('#experiment-record-protection')).toBeVisible();
});
for(const [route,key,notice] of [
 ['/index.html#experiment-energy','experiment','#experiment-record-protection'],
 ['/index.html#topology','topologyTransfer','[data-record-protection]'],
 ['/17_power_topology_control/index.html#guided-applications','topologyApplications','[data-record-protection]']
]) test(`same-version cross-tab ${key} evidence cannot be overwritten`,async({page,context})=>{
 await page.goto(route); await page.waitForFunction(()=>!!window.CircuitEvidence);
 await page.waitForTimeout(300);
 const other=await context.newPage();await other.goto('/map.html');await other.waitForSelector('#workspace-learning-records');
 const newer=await other.evaluate(key=>{const e=CircuitEvidence.load();const prior=e.benchmark.learningWorkspace?.[key]||{version:1,rows:{}};const updated={...prior,externalMarker:'preserve first answer from other tab'};e.benchmark.learningWorkspace||={version:1};e.benchmark.learningWorkspace[key]=updated;CircuitEvidence.save(e);return updated;},key);
 await expect(page.locator(notice).first()).toBeVisible();
 expect(await page.evaluate(key=>CircuitEvidence.load().benchmark.learningWorkspace[key],key)).toEqual(newer);
});
