const {test,expect}=require('@playwright/test');
test('an already open catalog adopts proof saved in another tab',async({page,context})=>{
 await page.goto('/catalog.html');await expect(page.locator('#learning-navigation [data-unified-resume]')).toBeVisible();
 const other=await context.newPage();await other.goto('/map.html');await expect(other.locator('#workspace-learning-records')).toBeVisible();
 await other.evaluate(()=>{const e=CircuitEvidence.load();e.benchmark.learningWorkspace={version:1,experiment:{version:1,completed:false,rows:Object.fromEntries(CircuitWorkspace.experimentLessons().map(l=>[l.id,{first:{correct:false},proof:{observation:true,reason:true},transferPassed:true}]))}};CircuitEvidence.save(e);});
 await expect(page.locator('#learning-navigation [data-unified-resume]')).toHaveAttribute('href',/#topology$/);
});
test('map and shared page resume agree on step proof rather than completion cache',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/map.html');await expect(page.locator('#workspace-learning-records')).toBeVisible();
 await page.evaluate(()=>{localStorage.clear();const e=CircuitEvidence.load();e.benchmark.learningWorkspace={version:1,experiment:{version:1,completed:true,rows:{}}};CircuitEvidence.save(e);});await page.reload();
 await expect(page.locator('[data-record-group=experiment]')).toContainText('0 / 8');await expect(page.locator('[data-learning-hub] [data-unified-resume]')).toHaveAttribute('href',/#experiment$/);
 const saved=await page.evaluate(()=>{const e=CircuitEvidence.load();e.benchmark.learningWorkspace.experiment={version:1,completed:false,rows:Object.fromEntries(CircuitWorkspace.experimentLessons().map(l=>[l.id,{first:{correct:false},proof:{observation:true,reason:true},transferPassed:true}]))};CircuitEvidence.save(e);return JSON.stringify(e.benchmark.learningWorkspace);});await page.reload();
 await expect(page.locator('[data-record-group=experiment]')).toContainText('8 / 8');await expect(page.locator('[data-learning-hub] [data-unified-resume]')).toHaveAttribute('href',/#topology$/);
 await page.goto('/catalog.html');await expect(page.locator('#learning-navigation [data-unified-resume]')).toHaveAttribute('href',/#topology$/);expect(await page.evaluate(()=>JSON.stringify(CircuitEvidence.load().benchmark.learningWorkspace))).toBe(saved);expect(errors).toEqual([]);
});
test('unsupported records resume at backup without rewriting practice',async({page})=>{
 await page.goto('/map.html');await expect(page.locator('#workspace-learning-records')).toBeVisible();
 const saved=await page.evaluate(()=>{localStorage.clear();const e=CircuitEvidence.load();e.benchmark.learningWorkspace={version:1,experiment:{version:99,completed:true,rows:{},futureField:'preserve'}};CircuitEvidence.save(e);return JSON.stringify(e.benchmark.learningWorkspace);});
 await page.reload();await expect(page.locator('[data-learning-hub] [data-unified-resume]')).toHaveAttribute('href',/map.html$/);
 await page.goto('/catalog.html');await expect(page.locator('#learning-navigation [data-unified-resume]')).toHaveAttribute('href',/map.html$/);
 expect(await page.evaluate(()=>JSON.stringify(CircuitEvidence.load().benchmark.learningWorkspace))).toBe(saved);
});
