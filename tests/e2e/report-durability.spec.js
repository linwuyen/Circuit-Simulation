const {test,expect}=require('@playwright/test');
const lab='pi.lab.pi-ki';
async function hold(context){const p=await context.newPage();await p.goto('/tests/');await p.evaluate(()=>{window.held=false;navigator.locks.request('circuit-learning-state-v5',()=>new Promise(resolve=>{window.release=resolve;window.held=true;}));});await expect.poll(()=>p.evaluate(()=>held)).toBe(true);return p;}
test('prediction remains pending and simulator disabled until durable lock commit',async({page,context})=>{
 await page.goto('/report.html?labId='+lab);await page.evaluate(()=>CircuitEvidence.flush());
 const holder=await hold(context);
 await page.fill('#prediction','Ki 增加會提高交越頻率');await page.fill('#parameters','Ki=6000 1/s');await page.click('#commitPrediction');
 expect(await page.locator('#openSimulator').getAttribute('href')).toBeNull();
 await expect(page.locator('#predictionStatus')).toContainText('尚未儲存');await expect(page.locator('#reportPreview')).toContainText('pending / not durably committed');
 expect(await page.evaluate(id=>JSON.parse(localStorage.getItem(CircuitEvidence.KEY)).predictions[id],lab)).toBeUndefined();
 await holder.evaluate(()=>release());
 await expect(page.locator('#predictionStatus')).toContainText('preregistered');
 await expect(page.locator('#openSimulator')).toHaveAttribute('aria-disabled','false');
 await page.reload();await expect(page.locator('#predictionStatus')).toContainText('preregistered');
});
test('conflicting prediction never enables simulator or claims preregistration',async({page,context})=>{
 await page.goto('/report.html?labId='+lab);await page.evaluate(()=>CircuitEvidence.flush());const holder=await hold(context);
 await page.fill('#prediction','Ki 增加會提高交越頻率');await page.fill('#parameters','Ki=6000 1/s');await page.click('#commitPrediction');
 await holder.evaluate(()=>{const key='circuit-learning-state-v5',s=JSON.parse(localStorage.getItem(key));s.events.push({type:'concurrent-winner'});localStorage.setItem(key,JSON.stringify(s));release();});
 await expect(page.locator('#predictionStatus')).toContainText('尚未儲存');await expect(page.locator('#learning-storage-status')).toContainText('衝突');
 expect(await page.locator('#openSimulator').getAttribute('href')).toBeNull();expect(await page.locator('#predictionStatus').textContent()).not.toContain('✓ preregistered');
});
test('report completion never claims durable evidence while the write lock is held',async({page,context})=>{
 await page.goto('/report.html?labId='+lab);
 await page.fill('#prediction','Ki增加時0dB交越頻率會提高，積分器增益曲線向上移。');await page.fill('#parameters','Ki=6000 1/s');await page.click('#commitPrediction');
 await expect(page.locator('#predictionStatus')).toContainText('preregistered');
 await page.goto('/4_PI/02_integrator.html');await expect(page.locator('.clt-root')).toBeAttached();await page.locator('#ki-slider').fill('6000');
 await expect.poll(()=>page.evaluate(id=>CircuitEvidence.machineEvents(id).filter(e=>e.verification?.passed&&e.verification?.independentValidated).length,lab)).toBeGreaterThan(0);await page.evaluate(()=>CircuitEvidence.flush());
 await page.goto('/report.html?labId='+lab);
 for(const [id,value] of Object.entries({observation:'0dB crossing 約 955 Hz，與獨立計算相符。',explanation:'Ki/s 積分器的 0dB crossing 由 Ki/(2π) 決定，幅頻斜率為 -20 dB/decade，相位約 -90°。',limitations:'離散取樣、plant 動態與運算延遲會讓單純連續積分器模型出現限制。',transfer:'若 Ki 增加到 12000，其他條件相同時 0dB crossing 約加倍。',nextStep:'下一步量測實際 plant 與 delay 後再看 phase margin。'}))await page.fill('#'+id,value);
 await page.evaluate(()=>CircuitEvidence.flush());const holder=await hold(context);await page.click('#completeReport');
 await expect(page.locator('#reportMessage')).toContainText('尚未儲存');await expect(page.locator('#observation')).toBeDisabled();await expect(page.locator('#labSelect')).toBeDisabled();expect(await page.locator('#reportMessage').textContent()).not.toContain('完成：Verified');
 await holder.evaluate(()=>release());await expect(page.locator('#reportMessage')).toContainText('Evidence strength A');
 expect(await page.evaluate(id=>JSON.parse(localStorage.getItem(CircuitEvidence.KEY)).evidence[id].strength,lab)).toBe('A');
});
