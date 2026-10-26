const {test,expect}=require('@playwright/test');
test('unfinished optional clamp cannot calculate or save; genuinely blank and valid values recover',async({page})=>{
 await page.goto('/15_power_capstone/lab_sandbox.html');
 await page.evaluate(async()=>{await CircuitEvidence.flush();globalThis.reviewWrites=0;const original=CircuitEvidence.recordMachine;CircuitEvidence.recordMachine=(...args)=>{reviewWrites++;return original(...args);};});
 await page.locator('#sb-clamp').pressSequentially('-');
 expect(await page.locator('#sb-clamp').evaluate(e=>e.validity.badInput)).toBe(true);
 await expect(page.locator('#sb-state')).toHaveText('INVALID');
 expect(await page.evaluate(()=>[__sandboxLast,reviewWrites])).toEqual([null,0]);
 await page.locator('#sb-clamp').fill('');await expect(page.locator('#sb-state')).toHaveText('RUN');
 await page.locator('#sb-clamp').fill('-.1');await expect(page.locator('#sb-state')).toHaveText('INVALID');
 await page.locator('#sb-clamp').fill('.5');await expect(page.locator('#sb-state')).toHaveText('RUN');
});
test('DMA unfinished inputs clear stale PASS/results and recover without uncaught errors',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/15_power_capstone/lab_dma.html');
 await expect(page.locator('#dma-status')).toContainText('PASS');
 await page.locator('#dma-ring').fill('');
 await expect(page.locator('#dma-status')).toHaveClass(/fail/);
 await expect(page.locator('#dma-vout')).toHaveText('—');
 expect(await page.evaluate(()=>__dmaLast)).toBe(null);
 await page.locator('#dma-ring').fill('4');await expect(page.locator('#dma-status')).toContainText('PASS');
 expect(errors).toEqual([]);
});
test('every new sandbox workflow link resolves and timing navigation reaches the controls',async({page})=>{
 await page.goto('/15_power_capstone/lab_sandbox.html');
 const missing=await page.locator('.sandbox-experiment-nav a[href^="#"]').evaluateAll(links=>links.filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash));
 expect(missing).toEqual([]);
 await page.locator('.sandbox-experiment-nav a[href="#sb-timing"]').click();
 await expect(page.locator('#sb-timing')).toBeInViewport();
});
test('legacy repair records stay intact with an explicit compatibility message on restore and import',async({page})=>{
 const legacy={schema:'circuit-repair-replay',version:1,modelVersion:'1.0.0',engineVersion:'3.2.0',seed:23,actions:[{type:'measure',id:'dmm'}]};
 await page.goto('/15_power_capstone/lab_multifault.html');
 await page.evaluate(async record=>{await CircuitEvidence.flush();const state=CircuitEvidence.load();state.benchmark.trainingPractice={sessions:[{id:'legacy-review',kind:'repair',seed:23,passed:false,revealed:false,rehearsal:false,replay:record}],seenRepairSeeds:[23]};CircuitEvidence.save(state);await CircuitEvidence.flush();},legacy);
 await page.reload();
 await expect(page.locator('#repair-status')).toContainText('3.2.0');
 await expect(page.locator('#repair-status')).toContainText('原始紀錄保留');
 expect(await page.evaluate(()=>CircuitTrainingRecords.read().sessions.find(x=>x.id==='legacy-review').replay)).toEqual(legacy);
 const before=await page.evaluate(()=>JSON.stringify(CircuitTrainingRecords.read()));
 await page.locator('#repair-import').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
 await expect(page.locator('#repair-status')).toContainText('目前為 3.3.0');
 expect(await page.evaluate(()=>JSON.stringify(CircuitTrainingRecords.read()))).toBe(before);
});
test('unfinished shared-reader seed is reported without an uncaught error and a valid machine can load',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/15_power_capstone/lab_multifault.html');
 await page.locator('#mf-seed').fill('');await page.locator('#mf-new').click();
 await expect(page.locator('#mf-status')).toHaveClass(/fail/);
 expect(await page.evaluate(()=>__multiFault)).toBe(null);
 await page.locator('#mf-seed').fill('24');await page.locator('#mf-new').click();
 await expect(page.locator('#mf-status')).not.toHaveClass(/fail/);
 expect(errors).toEqual([]);
});
