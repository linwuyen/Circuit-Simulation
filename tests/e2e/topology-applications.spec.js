const {test,expect}=require('@playwright/test');
async function answer(page,value){await page.locator(`input[name=application-answer][value=${value}]`).check();await page.locator('#application-submit').click();}
test.beforeEach(async({page})=>{await page.goto('/17_power_topology_control/');await page.evaluate(()=>localStorage.clear());await page.reload();await expect(page.locator('#application-prepare')).toBeVisible();});
test('all four applications operate the original controls and preserve separate snapshots',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const id of ['pfc','psfb','llc','inverter']){
  await page.locator('#application-prepare').click();await answer(page,'lower');await page.locator('#application-run').click();await expect(page.locator('#application-comparison')).toBeVisible();
  const actual=await page.evaluate(id=>{const r=CircuitEvidence.load().benchmark.learningWorkspace.topologyApplications.rows[id];return {saved:r.controls.after,actual:Object.fromEntries(Object.keys(r.controls.after).map(k=>[k,document.getElementById(k).tagName==='SELECT'?document.getElementById(k).value:Number(document.getElementById(k).value)]))};},id);expect(actual.actual).toEqual(actual.saved);
  await answer(page,'lower');await answer(page,'reason');await expect(page.locator('#application-next')).toBeVisible();if(id!=='inverter')await page.locator('#application-next').click();
 }
 await expect(page.locator('#application-progress')).toContainText('4 / 4');await page.reload();await expect(page.locator('#application-progress')).toContainText('4 / 4');
 expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.outcomeV1)).toBeUndefined();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('first wrong answers survive refresh; native edits require an explicit setup before operation',async({page})=>{
 await expect(page.locator('#application-submit')).toBeDisabled();await page.locator('#application-prepare').click();await answer(page,'higher');await page.locator('#pfcC').fill('1500');await expect(page.locator('#application-run')).toBeDisabled();await expect(page.locator('#application-live-state')).toContainText('其他設定');
 await page.locator('#application-prepare').click();await page.locator('#application-run').click();await answer(page,'higher');await expect(page.locator('.application-steps button').nth(2)).toBeDisabled();await answer(page,'lower');await answer(page,'other');await page.reload();
 const r=await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.topologyApplications.rows.pfc);expect(r.first.correct).toBe(false);expect(r.observationFirst.correct).toBe(false);expect(r.reasonFirst.correct).toBe(false);expect(r.reasonPassed).toBeUndefined();
 await expect(page.locator('#application-live-state')).toContainText('其他設定');await expect(page.locator('#application-comparison')).toBeVisible();await answer(page,'reason');await expect(page.locator('#application-next')).toBeVisible();
});
test('viewing tools alone does not create application progress and malformed saved snapshots fail closed',async({page})=>{
 expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace?.topologyApplications)).toBeUndefined();
 await page.evaluate(()=>{const s=CircuitEvidence.load();s.benchmark.learningWorkspace={version:1,topologyApplications:{version:1,rows:{pfc:{operated:true}}}};CircuitEvidence.save(s);});await page.reload();await expect(page.locator('#application-status')).toContainText('對照不完整');await expect(page.locator('#application-submit')).toHaveCount(0);
});
test('native chart return keeps the selected lesson and its heading below the sticky header',async({page})=>{
 await page.locator('#application-prepare').click();await answer(page,'lower');
 await page.locator('#guided-applications').getByRole('button',{name:'查看原電路與圖形'}).click();
 await page.locator('#pfc .application-return').click();
 await expect(page.locator('#application-run')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.querySelector('#guided-applications h2').getBoundingClientRect().top-document.querySelector('.topbar').getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(0);
 expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.topologyApplications.currentLesson)).toBe('pfc');
});
