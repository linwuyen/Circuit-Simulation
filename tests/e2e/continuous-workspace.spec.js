const { resetEvidence } = require('./evidence-fixture');
const{test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{await page.goto('/');await resetEvidence(page);await page.reload();});
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
 await page.evaluate(async ()=>{const s=CircuitEvidence.load();s.benchmark.beginnerLessons={version:1,rows:{duty:{first:{answer:'down',correct:false},transferPassed:true}}};CircuitEvidence.save(s);if(!(await CircuitEvidence.flush()).saved)throw Error("Fixture evidence not committed");});
 await answer(page,'down');await expect(page.locator('#workspace-submit')).toBeDisabled();await page.locator('#experiment-run').click();await answer(page,'same');await expect(page.locator('#ws-steps button').nth(2)).toBeDisabled();
 await answer(page,'up');await answer(page,'other');await expect(page.locator('#ws-feedback')).toContainText('這個判斷還不能解釋結果');await expect(page.locator('#workspace-submit')).toBeEnabled();await expect(page.locator('#ws-steps button').nth(3)).toBeDisabled();await page.reload();
 const s=await page.evaluate(()=>CircuitEvidence.load().benchmark);
 expect(s.learningWorkspace.experiment.rows.energy.first.correct).toBe(false);expect(s.learningWorkspace.experiment.rows.energy.observationFirst.correct).toBe(false);expect(s.learningWorkspace.experiment.rows.energy.reasonFirst.correct).toBe(false);
 expect(s.beginnerLessons.rows.duty.first.answer).toBe('down');await page.goto('/#experiment-protection');await expect(page.locator('#ws-title')).toContainText('開久一點');
});
test('context names the actual kernel and due review retains priority',async({page})=>{
 await page.locator('#workbench-context-slot summary').click();await expect(page.locator('.ec-model')).toContainText('generic-power-causal-kernel');await expect(page.locator('.ec-model')).toContainText('3.3.0');
 await page.evaluate(async ()=>{const s=CircuitEvidence.load();s.benchmark.outcomeV1={sessions:{post:{completedAt:'2026-01-01'}},retention:{r1:{dueAt:'2026-01-02'}}};CircuitEvidence.save(s);if(!(await CircuitEvidence.flush()).saved)throw Error("Fixture evidence not committed");});await page.reload();
 await expect(page.locator('#resume-task')).toHaveText('接續到期複習');await expect(page.locator('#resume-task')).toHaveAttribute('data-route',/layer=evidence/);
});
test('resume from embedded records returns to the outer experiment without nesting a second workspace',async({page})=>{
 await answer(page,'up');await page.locator('#experiment-run').click();await page.evaluate(()=>window.keptCircuit=document.getElementById('circuit'));
 await page.locator('#show-progress').click();await page.locator('#detailed-records').click();
 await page.frameLocator('#reference-frame').locator('[data-learning-hub] [data-unified-resume]').click();
 await expect(page.locator('#workspace-reference')).toBeHidden();await expect(page.locator('#ws-title')).toContainText('開久一點');
 expect(await page.evaluate(()=>window.keptCircuit===document.getElementById('circuit'))).toBe(true);
 expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.experiment.rows.energy.operated)).toBe(true);
});

test('model evidence appears only after operation and stays hidden on unseen transfer',async({page})=>{
 const evidence=page.locator('#experiment-causal-evidence');
 await expect(evidence).toBeHidden();
 await expect(page.locator('#ws-plot')).toBeVisible();
 await answer(page,'up');
 await expect(evidence).toBeHidden();
 await page.locator('#experiment-run').click();
 await expect(evidence).toBeVisible();
 await expect(evidence).toContainText('最後一段平均 Vout');
 await expect(evidence).toContainText('generic-power-causal-kernel');
 await answer(page,'up');
 await expect(evidence).toBeVisible();
 await answer(page,'reason');
 await expect(page.locator('#ws-voltage')).toHaveText('先預測');
 await expect(evidence).toBeHidden();
 await answer(page,'up');
 await expect(evidence).toBeVisible();
 await expect(evidence).toContainText('不是實板量測');
});

test('first Buck lesson synchronizes switch, current path and voltage slope on a scrubbed kernel cycle',async({page})=>{
 const inspector=page.locator('#switching-inspector');
 await expect(inspector).toBeHidden();
 await answer(page,'up');
 await expect(inspector).toBeHidden();
 await page.locator('#experiment-run').click();
 await expect(inspector).toBeVisible();
 await expect(page.locator('#switching-current-plot polyline')).toHaveCount(1);
 await expect(page.locator('#switching-status')).toContainText('開關 ON');
 await expect(page.locator('#switching-values')).toContainText('di/dt');
 await expect(page.locator('#switch')).toHaveAttribute('d','M140 70L200 70');
 const offIndex=await page.evaluate(()=>{
  const x=CircuitWorkspace.experimentRun(CircuitWorkspace.experimentPlan('energy').after);
  return x.waveform.findIndex(s=>!s.gate&&s.iL>1e-6);
 });
 expect(offIndex).toBeGreaterThan(0);
 await page.locator('#switching-sample').fill(String(offIndex));
 await expect(page.locator('#switching-status')).toContainText('開關 OFF');
 await expect(page.locator('#switching-explanation')).toContainText('二極體');
 await expect(page.locator('#switch')).toHaveAttribute('d','M140 70L200 45');
 await expect(page.locator('#switching-current-plot line')).toHaveCount(1);
 await answer(page,'up');
 await answer(page,'reason');
 await expect(page.locator('#ws-voltage')).toHaveText('先預測');
 await expect(inspector).toBeHidden();
});

test('beginner explanations teach physics without prematurely revealing graded transfer answers',async({page})=>{
 const guide=page.locator('#novice-guide');
 await expect(guide).toContainText('PWM');
 await expect(guide).not.toContainText('完整因果鏈');
 await answer(page,'up');
 await expect(guide).not.toContainText('拿著這個問題去看電路');
 await page.locator('#experiment-run').click();
 await expect(guide).toContainText('拿著這個問題去看電路');
 await expect(guide).toContainText('時間游標');
 await answer(page,'up');
 await answer(page,'reason');
 await expect(page.locator('#ws-voltage')).toHaveText('先預測');
 await expect(guide).not.toContainText('完整因果鏈');
 await answer(page,'up');
 await expect(guide).toContainText('完整因果鏈');
 await expect(guide).toContainText('36 V');
});

test('a wrong novice prediction reveals an optional misconception cue without changing the first-attempt result',async({page})=>{
 await answer(page,'down');
 await page.locator('#experiment-run').click();
 const hint=page.locator('#novice-remediation');
 await expect(hint).toBeVisible();
 await hint.locator('summary').click();
 await expect(hint).toContainText('輸入的電流路徑');
 const first=await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.experiment.rows.energy.first.correct);
 expect(first).toBe(false);
 await page.reload();
 await expect(page.locator('#novice-remediation')).toBeVisible();
});
