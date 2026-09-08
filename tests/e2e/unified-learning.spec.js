const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{await page.goto('/map.html');await expect(page.locator('#learning-track')).toBeVisible();await page.evaluate(()=>localStorage.clear());await page.reload();await expect(page.locator('#learning-track')).toBeVisible();});
test('resume integrates beginner progress and advanced selection without granting mastery',async({page})=>{
 await expect(page.locator('[data-learning-hub] [data-unified-resume]')).toHaveAttribute('href',/learn_basics.html#duty/);
 await page.evaluate(()=>{const e=CircuitEvidence.load();e.benchmark.beginnerLessons={version:1,rows:{duty:{first:{correct:false},observed:true,proof:{observation:true,reason:true},transferPassed:true}}};CircuitEvidence.save(e);});await page.reload();
 await expect(page.locator('[data-learning-hub] [data-unified-resume]')).toHaveAttribute('href',/#inductor/);
 await page.locator('#learning-track').selectOption('core');await expect(page.locator('[data-learning-hub] [data-unified-resume]')).toHaveAttribute('href',/layer=physics/);
 expect(await page.evaluate(()=>CircuitCoreFlowV1.progress().done)).toBe(0);
 await page.locator('#learning-track').selectOption('specialize');await expect(page.locator('[data-learning-hub] [data-unified-resume]')).toHaveAttribute('href',/17_power_topology_control/);
 expect(await page.locator('[data-learning-hub] .learning-stage').count()).toBe(8);
});
test('shared case settings survive navigation and only apply to the compatible sandbox model',async({page})=>{
 await page.goto('/learning-case.html');await expect(page.locator('#learning-navigation')).toBeVisible();
 await page.locator('#case-vin').fill('36');await page.locator('#case-vin').blur();await expect(page.locator('#case-summary')).toContainText('9.00 V');
 await page.locator('#case-save').click();await page.goto('/15_power_capstone/lab_sandbox.html#training-workbench');await expect(page.locator('#shared-settings')).toBeVisible();await expect(page.locator('#shared-settings')).toContainText('Vin 36 V');
 await page.getByRole('button',{name:'套用上述設定，另開實驗'}).click();await expect(page.locator('#tr-vin')).toHaveValue('36');await expect(page.locator('#sb-vin')).toHaveValue('80');
 await page.locator('#tr-load').fill('100');await page.locator('#tr-load').blur();await page.getByRole('button',{name:'保存目前電路為共用設定'}).click();await page.goto('/learning-case.html');await page.locator('#case-load-saved').click();await expect(page.locator('#case-summary')).toContainText('DCM');await page.locator('#tab-control').click();await expect(page.locator('#case-boundary')).toContainText('停用');await expect(page.locator('#case-frequency polyline')).toHaveCount(0);
});
test('remediation flow returns to the originating task after a live transfer check',async({page})=>{
 await page.evaluate(()=>{CircuitCoreFlowV1.recordPrediction('sensing','wrong',false);CircuitUnifiedLearning.write({track:'core'});CircuitUnifiedLearning.beginReturn('core-sensing','unit');});
 await page.goto('/15_power_capstone/lab_sandbox.html?remediation=unit&learnFrom=core-sensing#training-remediation');await expect(page.locator('#learning-navigation')).toBeVisible();
 await page.locator('#tr-answer-controls input').fill('1');await page.locator('#tr-answer').click();await page.locator('#tr-mini').click();
 const question=await page.locator('#tr-transfer-question').innerText();const uh=Number(question.match(/([\d.]+) µH/)[1]);await page.locator('#tr-transfer-controls input').fill(String(uh*1e-6));await page.locator('#tr-transfer-answer').click();
 await expect(page.locator('#learning-navigation')).toContainText('補強新條件已通過');await expect(page.getByRole('link',{name:'返回原任務：量測主線任務'})).toHaveAttribute('href',/layer=sensing/);
 expect(await page.evaluate(()=>CircuitCoreFlowV1.snapshot().predictions.sensing.correct)).toBe(false);expect(await page.evaluate(()=>CircuitCoreFlowV1.progress().done)).toBe(0);
});
test('view tabs support keyboard, glossary is shared and no horizontal overflow',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/learning-case.html');await expect(page.locator('#learning-navigation')).toBeVisible();await page.locator('#tab-physical').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#tab-sensing')).toHaveAttribute('aria-selected','true');await expect(page.locator('#view-sensing')).toBeVisible();
 await page.locator('#learning-navigation > details > summary').click();await page.getByText('查一個詞，不必離開目前任務',{exact:true}).click();await expect(page.locator('#learning-navigation')).toContainText('ADC：把電壓轉成數字');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('invalid origin cannot create an external return link',async({page})=>{
 await page.goto('/learning-case.html?learnFrom=https%3A%2F%2Fevil.invalid');await expect(page.locator('#learning-navigation')).toBeVisible();await expect(page.getByRole('link',{name:/返回原任務/})).toHaveCount(0);
});
