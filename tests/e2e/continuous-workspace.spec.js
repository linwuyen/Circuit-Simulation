const{test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();});
async function answer(page,value){await page.locator(`input[name="experiment-answer"][value="${value}"]`).check();await page.locator('#workspace-submit').click();}
test('eight experiments use one circuit, carry settings and preserve separate proof records',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.evaluate(()=>window.originalCircuit=document.getElementById('circuit'));
 const lessons=await page.evaluate(()=>CircuitWorkspace.experimentLessons());
 for(const l of lessons){
  await expect(page.locator('#ws-title')).toHaveText(l.title);
  if(l.prepare){await expect(page.locator('#setup-panel')).toBeVisible();await expect(page.locator('#workspace-submit')).toBeDisabled();await page.locator('#apply-setup').click();}
  await answer(page,l.answer);await page.locator('#experiment-run').click();await expect(page.locator('#ws-plot polyline').first()).toBeVisible();
  await answer(page,l.answer);await answer(page,'reason');await expect(page.locator('#ws-voltage')).toHaveText('先預測');await expect(page.locator('#ws-plot')).toBeHidden();
  const main=await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.experiment.currentConfig);
  await answer(page,l.answer);await expect(page.locator('#ws-result')).toBeVisible();
  expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.experiment.currentConfig)).toEqual(main);
  expect(await page.evaluate(()=>window.originalCircuit===document.getElementById('circuit'))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(l.id!=='protection')await page.locator('#ws-next').click();
 }
 await expect(page.locator('#workspace-progress')).toContainText('8 / 8');await page.reload();await expect(page.locator('#workspace-progress')).toContainText('8 / 8');
 expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.beginnerLessons?.rows?.duty)).toBeUndefined();
 expect(errors).toEqual([]);
});
test('wrong attempts cannot unlock proof, reload retains first attempts and legacy evidence',async({page})=>{
 await page.evaluate(()=>{const s=CircuitEvidence.load();s.benchmark.beginnerLessons={version:1,rows:{duty:{first:{answer:'down',correct:false},transferPassed:true}}};CircuitEvidence.save(s);});
 await answer(page,'down');await expect(page.locator('#workspace-submit')).toBeDisabled();await page.locator('#experiment-run').click();await answer(page,'same');await expect(page.locator('#ws-steps button').nth(2)).toBeDisabled();
 await answer(page,'up');await answer(page,'other');await expect(page.locator('#ws-steps button').nth(3)).toBeDisabled();await page.reload();
 const s=await page.evaluate(()=>CircuitEvidence.load().benchmark);
 expect(s.learningWorkspace.experiment.rows.energy.first.correct).toBe(false);expect(s.learningWorkspace.experiment.rows.energy.observationFirst.correct).toBe(false);expect(s.learningWorkspace.experiment.rows.energy.reasonFirst.correct).toBe(false);
 expect(s.beginnerLessons.rows.duty.first.answer).toBe('down');await page.goto('/#experiment-protection');await expect(page.locator('#ws-title')).toContainText('開久一點');
});
test('context names the actual kernel and due review retains priority',async({page})=>{
 await page.locator('#workbench-context-slot summary').click();await expect(page.locator('.ec-model')).toContainText('generic-power-causal-kernel');await expect(page.locator('.ec-model')).toContainText('3.2.0');
 await page.evaluate(()=>{const s=CircuitEvidence.load();s.benchmark.outcomeV1={sessions:{post:{completedAt:'2026-01-01'}},retention:{r1:{dueAt:'2026-01-02'}}};CircuitEvidence.save(s);});await page.reload();
 await expect(page.locator('#resume-task')).toHaveText('接續到期複習');await expect(page.locator('#resume-task')).toHaveAttribute('data-route',/layer=evidence/);
});
