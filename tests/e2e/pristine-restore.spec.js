const{test,expect}=require('@playwright/test');
test('visiting the homepage before restoring does not discard backup progress',async({page})=>{
 await page.goto('/index.html#experiment-energy');await expect(page.locator('#workspace-submit')).toBeVisible();
 expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.experiment.rows.energy)).toEqual({});
 await page.goto('/map.html');await page.waitForSelector('#learning-backup');
 const payload=await page.evaluate(()=>{const p=JSON.parse(CircuitEvidence.exportBackup());p.benchmark.learningWorkspace.experiment={version:1,completed:false,rows:Object.fromEntries(CircuitWorkspace.experimentLessons().map(l=>[l.id,{first:{correct:false,answer:'saved'},proof:{observation:true,reason:true},transferPassed:true}]))};return p;});
 await page.locator('#learning-backup-file').setInputFiles({name:'progress.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});await page.locator('#learning-backup-confirm').click();
 await expect(page.locator('[data-record-group=experiment]')).toContainText('8 / 8');await expect(page.locator('[data-learning-hub] [data-unified-resume]')).toHaveAttribute('href',/#topology$/);
 expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.experiment.rows.energy.first.correct)).toBe(false);
});
