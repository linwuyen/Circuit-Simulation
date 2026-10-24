const {test,expect}=require('@playwright/test');
async function hold(page){await page.evaluate(async()=>{await CircuitEvidence.flush();await new Promise(resolve=>navigator.locks.request(CircuitEvidence.KEY,()=>new Promise(release=>{window.releaseAcceptance=release;resolve();})));});}
test('nonempty quiz feedback is not an accepted-answer boundary',async({page})=>{
 await page.goto('/quiz.html');const card=page.locator('.quiz-card[data-current-question]').first();await hold(page);await card.locator('[data-question]').first().click();
 // The former not-empty predicate passes while nothing has committed.
 await expect(card.locator('.quiz-result')).not.toBeEmpty();expect(await page.evaluate(()=>CircuitEvidence.storageStatus().saved)).toBe(false);await expect(card.locator('.quiz-explain')).toHaveCount(0);
 await page.evaluate(()=>releaseAcceptance());await expect(card.locator('.quiz-explain')).toBeVisible();expect(await page.evaluate(()=>CircuitEvidence.storageStatus().saved)).toBe(true);
});
test('disabled later application step is not acceptance of a wrong answer',async({page})=>{
 await page.goto('/17_power_topology_control/');await page.locator('#application-prepare').click();await page.locator('input[name=application-answer][value=lower]').check();await page.locator('#application-submit').click();await page.locator('#application-run').click();await expect(page.locator('#application-comparison')).toBeVisible();await hold(page);
 await page.locator('input[name=application-answer][value=higher]').check();await page.locator('#application-submit').click();await expect(page.locator('.application-steps button').nth(2)).toBeDisabled();expect(await page.evaluate(()=>CircuitEvidence.storageStatus().saved)).toBe(false);await expect(page.locator('#application-status')).not.toContainText('首次判斷會保留');
 await page.evaluate(()=>releaseAcceptance());await expect(page.locator('#application-status')).toContainText('首次判斷會保留');await expect(page.locator('#application-submit')).toBeEnabled();await page.reload();expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.topologyApplications.rows.pfc.observationFirst.correct)).toBe(false);
});
test('machine readiness ignores old durable events and a new pending oracle draft',async({page})=>{
 const {machineCount,waitForMachineEvidence}=require('./machine-evidence-ready');
 await page.goto('/4_PI/02_integrator.html');await expect(page.locator('.clt-root')).toBeAttached();let before=await machineCount(page,'pi.lab.pi-ki');await page.locator('#ki-slider').fill('6000');await waitForMachineEvidence(page,'pi.lab.pi-ki',before,{ki:6000});
 before=await machineCount(page,'pi.lab.pi-ki');await hold(page);await page.locator('#ki-slider').fill('7000');let ready=false;const waiting=waitForMachineEvidence(page,'pi.lab.pi-ki',before,{ki:7000}).then(()=>{ready=true;});
 await expect.poll(()=>page.evaluate(()=>CircuitEvidence.machineEvents('pi.lab.pi-ki').some(e=>e.verification?.observableContract?.typed?.inputs?.ki===7000))).toBe(true);
 await expect(page.locator('html')).toHaveAttribute('data-evidence-persistence','pending');expect(ready).toBe(false);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(CircuitEvidence.KEY)).evidence['pi.lab.pi-ki'].machine.some(e=>e.verification?.observableContract?.typed?.inputs?.ki===7000))).toBe(false);
 await page.evaluate(()=>releaseAcceptance());await waiting;expect(ready).toBe(true);
});
