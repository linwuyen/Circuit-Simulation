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
