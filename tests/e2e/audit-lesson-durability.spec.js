const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{page.auditErrors=[];page.on('pageerror',error=>page.auditErrors.push(error.message));});
test.afterEach(async({page})=>{expect(page.auditErrors).toEqual([]);});
async function hold(page){
 await page.evaluate(async()=>{await CircuitEvidence.flush();window.auditLockReady=new Promise(resolve=>navigator.locks.request(CircuitEvidence.KEY,()=>new Promise(release=>{window.auditRelease=release;resolve();})));await window.auditLockReady;});
}
async function release(page){await page.evaluate(()=>window.auditRelease());}
async function answer(page,name,value,submit){await page.locator(`input[name="${name}"][value="${value}"]`).check();await page.locator(submit).click();}
test('bridge completion is provisional until the evidence lock commits',async({page})=>{
 await page.goto('/control-basics.html#error');
 const l=await page.evaluate(()=>CircuitPlainCourse.bridge[0]);
 await answer(page,'prediction',l.answer,'#predict');await page.locator('#experiment-control').fill(String(l.target));
 await answer(page,'observation',l.observed,'#observation-submit');await answer(page,'reason',l.because,'#reason-submit');
 await hold(page);await page.locator('#transfer-value').fill(String(l.expected));await page.locator('#transfer-submit').click();
 await expect(page.locator('#simple-result')).toBeHidden();await expect(page.locator('#transfer-submit')).toBeDisabled();
 await release(page);await expect(page.locator('#simple-result')).toBeVisible();await page.reload();await expect(page.locator('#simple-result')).toBeVisible();
});
test('topology reasoning does not advance before durable acceptance',async({page})=>{
 await page.goto('/#topology');await answer(page,'topology-answer','both','#topology-submit');await page.locator('#topology-run').click();
 await answer(page,'topology-answer','separate','#topology-submit');await expect(page.locator('input[name="topology-answer"][value="path"]')).toBeVisible();
 await hold(page);await answer(page,'topology-answer','path','#topology-submit');
 await expect(page.locator('input[name="topology-answer"][value="path"]')).toBeVisible();await expect(page.locator('#topology-submit')).toBeDisabled();
 await release(page);await expect(page.locator('#ws-question h2')).toContainText('回到降壓');await page.reload();await expect(page.locator('#ws-question h2')).toContainText('回到降壓');
});
for(const kind of ['bridge','topology'])test(kind+' failed storage does not accept the pending judgment',async({page})=>{
 await page.goto(kind==='bridge'?'/control-basics.html#error':'/#topology');
 await page.evaluate(async()=>{await CircuitEvidence.flush();const original=Storage.prototype.setItem;window.auditRestoreStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key===CircuitEvidence.KEY)throw new DOMException('Test quota','QuotaExceededError');return original.call(this,key,value);};const state=CircuitEvidence.load();state.benchmark.durabilityProbe=true;CircuitEvidence.save(state);await CircuitEvidence.flush();});
 if(kind==='bridge'){
  await answer(page,'prediction',await page.evaluate(()=>CircuitPlainCourse.bridge[0].answer),'#predict');
  await expect(page.locator('#save-status')).toContainText('本次判斷尚未接受');
  await expect(page.locator('#predict')).toBeDisabled();await expect(page.locator('[data-stage="1"]')).toBeHidden();
 }else{
  await answer(page,'topology-answer','both','#topology-submit');
  await expect(page.locator('#ws-save')).toContainText('本次判斷尚未接受');
  await expect(page.locator('#topology-submit')).toBeDisabled();await expect(page.locator('input[name="topology-answer"][value="both"]')).toBeVisible();
 }
 await expect(page.locator('#learning-storage-status').getByRole('button',{name:'重試儲存'})).toBeEnabled();
 await expect(page.locator('#learning-storage-status').getByRole('button',{name:'匯出備份'})).toBeEnabled();
 await page.evaluate(()=>window.auditRestoreStorage());
 await page.locator('#learning-storage-status').getByRole('button',{name:'重試儲存'}).click();
 await expect(page.locator(kind==='bridge'?'#save-status':'#ws-save')).toContainText('請重新整理');
 await page.reload();
 if(kind==='bridge')await expect(page.locator('[data-stage="1"]')).toBeVisible();else await expect(page.locator('#topology-run')).toBeVisible();
});
for(const kind of ['legacy','experiment'])test(kind+' completion waits for durable evidence',async({page})=>{
 await page.goto(kind==='legacy'?'/#duty':'/#experiment-energy');
 const config=await page.evaluate(kind=>{const l=kind==='legacy'?CircuitBeginnerLessons.lessons.find(l=>l.id==='duty'):CircuitWorkspace.experimentLessons()[0];return l;},kind);
 const name=kind==='legacy'?'workspace-answer':'experiment-answer';
 await answer(page,name,config.answer,'#workspace-submit');
 if(kind==='legacy')await page.locator('#ws-control').fill(String(config.target));else await page.locator('#experiment-run').click();
 const observed=kind==='legacy'?await page.evaluate(()=>CircuitPlainCourse.checks.duty.observed):config.answer;
 await answer(page,name,observed,'#workspace-submit');
 const reason=kind==='legacy'?await page.evaluate(()=>CircuitPlainCourse.checks.duty.because):'reason';
 await answer(page,name,reason,'#workspace-submit');
 await hold(page);
 if(kind==='legacy'){await page.locator('#workspace-answer').fill(String(config.expected));await page.locator('#workspace-submit').click();}else await answer(page,name,config.answer,'#workspace-submit');
 await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'unrelated-setting',newValue:'updated'})));
 await expect(page.locator('#ws-result')).toBeHidden();await expect(page.locator('#workspace-submit')).toBeDisabled();
 await expect(page.locator('#workspace-progress')).not.toContainText('已練習 1');
 await release(page);await expect(page.locator('#ws-result')).toBeVisible();await page.reload();await expect(page.locator('#ws-result')).toBeVisible();
 if(kind==='legacy'){
  await hold(page);await page.locator('#explore').click();
  await expect(page.locator('#ws-question')).not.toContainText('就在這台電路上自由探索');await expect(page.locator('#surface-status')).not.toContainText('課堂設定已保存');
  await release(page);await expect(page.locator('#surface-status')).toContainText('課堂設定已保存');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(CircuitEvidence.KEY)).benchmark.learningWorkspace.mode)).toBe('free');
 }
});
test('bridge stale mounted draft cannot replace another tab first answer',async({page,context})=>{
 await page.goto('/control-basics.html#error');
 const other=await context.newPage();await other.goto('/control-basics.html#error');
 const l=await other.evaluate(()=>CircuitPlainCourse.bridge[0]);await answer(other,'prediction',l.answer,'#predict');await expect(other.locator('[data-stage="1"]')).toBeVisible();
 await page.locator(`input[name="prediction"]:not([value="${l.answer}"])`).first().check();await page.locator('#predict').click();
 await expect(page.locator('#save-status')).toContainText('另一頁');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(CircuitEvidence.KEY)).benchmark.bridgeLessons.rows.error.first.answer)).toBe(l.answer);
 await expect(page.locator('[data-stage="1"]')).toBeHidden();
 await page.evaluate(()=>{location.hash='adjust';window.dispatchEvent(new CustomEvent('circuit:evidence-persistence',{detail:{saved:true}}));});
 await expect(page.locator('#save-status')).toContainText('另一頁');await expect(page.locator('#predict')).toBeDisabled();
 await expect(page.locator('#bridge-record-conflict button')).toBeEnabled();const download=page.waitForEvent('download');await page.locator('#bridge-record-conflict button').click();expect((await download).suggestedFilename()).toBe('unaccepted-bridge-draft.json');
});
test('bridge does not replace an unsupported saved course record',async({page})=>{
 await page.goto('/control-basics.html#error');
 const future={version:99,rows:{future:{sentinel:'preserve'}}};
 await page.evaluate(async future=>{await CircuitEvidence.flush();const state=CircuitEvidence.load();state.benchmark.bridgeLessons=future;CircuitEvidence.save(state);await CircuitEvidence.flush();},future);
 await page.reload();await page.locator('input[name="prediction"]').first().check();await page.locator('#predict').click();
 await expect(page.locator('#save-status')).toContainText('版本無法讀取');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(CircuitEvidence.KEY)).benchmark.bridgeLessons)).toEqual(future);
});
