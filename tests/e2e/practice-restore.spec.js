const{test,expect}=require('@playwright/test');
for(const key of ['topologyTransfer','topologyApplications'])test(key+' restores backup after opening without practicing',async({page})=>{
 await page.goto(key==='topologyTransfer'?'/index.html#topology':'/17_power_topology_control/index.html#guided-applications');
 if(key==='topologyTransfer')await expect(page.locator('#topology-submit')).toBeVisible();else{await page.locator('#guided-applications nav[aria-label="四種電路練習"] button').nth(1).click();}
 expect(await page.evaluate(key=>CircuitEvidence.load().benchmark.learningWorkspace[key].rows,key)).toEqual({});
 const payload=await page.evaluate(key=>{const p=JSON.parse(CircuitEvidence.exportBackup());const r=p.benchmark.learningWorkspace[key];if(key==='topologyTransfer'){r.operated=true;r.rows={prediction:{first:{correct:false}},observation:{passed:true},reason:{passed:true},return:{passed:true}};}else{r.rows=Object.fromEntries(CircuitWorkspace.applicationLessons().map(l=>{const plan=CircuitWorkspace.applicationPlan(l.id);return [l.id,{before:CircuitWorkspace.applicationRun(l.id,plan.before),after:CircuitWorkspace.applicationRun(l.id,plan.after),protocol:'topology-application-v1',first:{correct:false},operated:true,observationPassed:true,reasonPassed:true}];}));}return p;},key);
 await page.goto('/map.html');await page.waitForSelector('#learning-backup');
 await page.locator('#learning-backup-file').setInputFiles({name:'progress.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});await page.locator('#learning-backup-confirm').click();
 await expect(page.locator('[data-record-group='+(key==='topologyTransfer'?'topology':'applications')+']')).toContainText(key==='topologyTransfer'?'1 / 1':'4 / 4');
 expect(await page.evaluate(key=>{const r=CircuitEvidence.load().benchmark.learningWorkspace[key];return key==='topologyTransfer'?r.rows.prediction.first.correct:r.rows.pfc.first.correct;},key)).toBe(false);
 if(key==='topologyApplications'){await page.goto('/17_power_topology_control/index.html#guided-applications');await expect(page.locator('#application-progress')).toContainText('4 / 4');}
});
