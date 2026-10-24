const {test,expect}=require('@playwright/test');
for(const kind of ['workspace','quiz'])test(kind+' wrong feedback certifies durability, not an already-disabled next stage',async({page,context})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const family='topology-pfc-scaling';
 await page.goto(kind==='workspace'?'/#duty':'/quiz.html?module=power-topology-control');
 async function answer(value){await expect(page.locator('#workspace-submit')).toBeEnabled();await page.locator(`input[name=workspace-answer][value="${value}"]`).check();await page.locator('#workspace-submit').click();}
 if(kind==='workspace'){
  await answer('down');await page.locator('#ws-control').fill('50');await answer('same');await expect(page.locator('#ws-feedback')).toContainText('再比較');await answer('voltage-up');await expect(page.locator('input[value=always]')).toBeVisible();
 }else{
  const q=await page.locator(`[data-family-id="${family}"]`).getAttribute('data-current-question');await page.locator(`[data-family="${family}"][data-option="correct"]`).click();await expect(page.locator(`[data-family-id="${family}"]`)).not.toHaveAttribute('data-current-question',q);
 }
 const holder=await context.newPage();await holder.goto('/control-basics.html');
 await holder.evaluate(()=>new Promise(resolve=>{navigator.locks.request(CircuitEvidence.KEY,()=>new Promise(release=>{window.releaseAuditLock=release;resolve();}));}));
 if(kind==='workspace'){await answer('always');await expect(page.locator('#ws-steps button').nth(3)).toBeDisabled();}else await page.locator(`[data-family="${family}"][data-option="wrong-0"]`).click();
 const feedback=page.locator(kind==='workspace'?'#ws-feedback':`[data-family-id="${family}"] .quiz-result`),submit=page.locator(kind==='workspace'?'#workspace-submit':`[data-family="${family}"][data-option="correct"]`),acceptedText=kind==='workspace'?'這個原因還不能解釋':'可能迷思';
 await expect(submit).toBeDisabled();await expect(feedback).not.toContainText(acceptedText);
 const snapshot=await page.evaluate(({kind,family})=>{const E=CircuitEvidence,raw=JSON.parse(localStorage.getItem(E.KEY)),draft=E.load();const pick=s=>kind==='workspace'?s.benchmark.beginnerLessons.rows.duty.reasonFirst?.correct:s.questions[family].history.find(h=>h.assessmentRole==='transfer')?.correct;return {saved:E.storageStatus().saved,raw:pick(raw)??null,draft:pick(draft)};},{kind,family});
 expect(snapshot).toEqual({saved:false,raw:null,draft:false});
 await holder.evaluate(()=>window.releaseAuditLock());await expect(feedback).toContainText(acceptedText);await expect(submit).toBeEnabled();
 await page.reload();const first=await page.evaluate(({kind,family})=>{const s=CircuitEvidence.load();return kind==='workspace'?s.benchmark.beginnerLessons.rows.duty.reasonFirst.correct:s.questions[family].history.find(h=>h.assessmentRole==='transfer').correct;},{kind,family});
 expect(first).toBe(false);expect(errors).toEqual([]);
});
