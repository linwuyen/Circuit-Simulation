const {test,expect}=require('@playwright/test');
const cases=[{key:'topologyTransfer',url:'/index.html#topology',ready:'#topology-submit'},{key:'topologyApplications',url:'/17_power_topology_control/index.html#guided-applications',ready:'#application-prepare'}];
const future={version:99,rows:{future:{answer:'preserve'}},completed:true};
for(const item of cases){
 test(item.key+' rejects a newer record at save time',async({page})=>{
  await page.goto(item.url);await expect(page.locator(item.ready)).toBeVisible();
  if(item.key==='topologyTransfer')await page.locator('#ws-question input').first().check();
  await page.evaluate(({key,record})=>{const e=CircuitEvidence.load();e.benchmark.learningWorkspace||={version:1};e.benchmark.learningWorkspace[key]=record;CircuitEvidence.save(e);},{key:item.key,record:future});
  await page.locator(item.ready).click();
  expect(await page.evaluate(key=>CircuitEvidence.load().benchmark.learningWorkspace[key],item.key)).toEqual(future);
  await expect(page.locator('[data-record-protection]')).toBeVisible();await expect(page.locator('[data-record-protection] a')).toHaveAttribute('href',/map.html$/);
 });
 test(item.key+' pauses for a cross-tab future record and retains it on direct reload',async({page,context})=>{
  await page.goto(item.url);await expect(page.locator(item.ready)).toBeVisible();const other=await context.newPage();await other.goto('/map.html');await other.waitForSelector('#workspace-learning-records');
  await other.evaluate(({key,record})=>{const e=CircuitEvidence.load();e.benchmark.learningWorkspace||={version:1};e.benchmark.learningWorkspace[key]=record;CircuitEvidence.save(e);},{key:item.key,record:future});
  await expect(page.locator('[data-record-protection]')).toBeVisible();
  expect(await page.evaluate(key=>CircuitEvidence.load().benchmark.learningWorkspace[key],item.key)).toEqual(future);
  await page.reload();await expect(page.locator('[data-record-protection]')).toBeVisible();
  await expect(page.locator('[data-record-protection] a')).toHaveAttribute('href',/map.html$/);
  expect(await page.evaluate(key=>CircuitEvidence.load().benchmark.learningWorkspace[key],item.key)).toEqual(future);
 });
}
