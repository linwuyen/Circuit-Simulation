const {test,expect}=require('@playwright/test');
async function answer(page,value){await page.locator(`input[name="topology-answer"][value="${value}"]`).check();await page.locator('#topology-submit').click();}
test.beforeEach(async({page})=>{await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.goto('/#topology');await expect(page.locator('#topology-submit')).toBeEnabled();});
test('shared comparison gates observations, keeps wrong first attempts and resumes after refresh',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await expect(page.locator('#circuit')).toHaveAccessibleName('降壓與升壓的能量路徑示意');await expect(page.locator('#circuit')).toHaveAccessibleDescription(/開關關閉後經二極體/);await expect(page.locator('#ws-plot')).toBeHidden();await expect(page.locator('#ws-title')).toContainText('降壓和升壓');await expect(page.locator('#ws-voltage')).toHaveText('先預測');
 await answer(page,'buck');await expect(page.locator('#topology-submit')).toBeDisabled();await page.locator('#topology-run').click();
 await expect(page.locator('#topology-comparison')).toContainText('40% → 50%');await expect(page.locator('#ws-voltage')).toHaveText('24.00 V');await expect(page.locator('#ws-current')).toHaveText('96.00 V');
 await answer(page,'faster');await expect(page.locator('#ws-steps button').nth(2)).toBeDisabled();await answer(page,'separate');await answer(page,'path');await page.reload();
 await expect(page.locator('#ws-question h2')).toContainText('回到降壓');await answer(page,'copy');await expect(page.locator('#ws-result')).toBeHidden();await answer(page,'recheck');await expect(page.locator('#ws-result')).toBeVisible();
 const s=await page.evaluate(()=>CircuitEvidence.load());expect(s.benchmark.learningWorkspace.topologyTransfer.rows.prediction.first.correct).toBe(false);expect(s.benchmark.learningWorkspace.topologyTransfer.rows.observation.first.correct).toBe(false);expect(s.benchmark.learningWorkspace.topologyTransfer.completed).toBe(true);expect(s.benchmark.outcomeV1).toBeUndefined();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('Module 17 explicitly applies exact shared units then returns to the same comparison',async({page})=>{
 await answer(page,'both');const record=await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.topologyTransfer);
 await page.locator('#deeper').click();await page.locator('#apply-workspace-topology').click();await expect(page.locator('#workspace-transfer [role=status]')).toContainText('已套用');
 await expect(page.locator('#dutyBuck')).toHaveValue('40');await expect(page.locator('#dutyBoost')).toHaveValue('40');await expect(page.locator('#lBuck')).toHaveValue('500');await expect(page.locator('#esrBuck')).toHaveValue('0');await expect(page.locator('#buckVout')).toHaveText('19.20 V');await expect(page.locator('#boostVout')).toHaveText('80.0 V');
 await page.locator('#workspace-transfer a').click();await expect(page.locator('#topology-run')).toBeVisible();expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.topologyTransfer)).toEqual(record);
});
test('fixed concept first attempts survive refresh and cannot be rewritten by a second click',async({page})=>{
 await page.goto('/17_power_topology_control/');const card=page.locator('[data-p5-case]').first();await card.locator('[data-p5-answer]').nth(1).click();await card.locator('[data-p5-answer]').first().click();await page.reload();
 await expect(page.locator('#p5ChallengeScore')).toHaveText('0/5 首次符合模型');await expect(card.locator('[data-p5-result]')).toContainText('ESR zero');
 const s=await page.evaluate(()=>CircuitEvidence.load());expect(Object.values(s.benchmark.learningWorkspace.topologyConcepts.rows)[0].first.correct).toBe(false);expect(s.benchmark.outcomeV1).toBeUndefined();
});
test('out-of-range shared records are rejected without replacing evidence or clamping controls',async({page})=>{
 await page.evaluate(()=>{const s=CircuitEvidence.load();s.benchmark.learningWorkspace.topologyTransfer.params.vin=999;CircuitEvidence.save(s);});await page.reload();await expect(page.locator('#ws-question')).toContainText('比較條件無效');await expect(page.locator('#topology-run')).toBeHidden();
 await page.goto('/17_power_topology_control/');await page.locator('#apply-workspace-topology').click();await expect(page.locator('#workspace-transfer [role=status]')).toContainText('尚未套用任何改動');await expect(page.locator('#vinBuck')).toHaveValue('48');
});
