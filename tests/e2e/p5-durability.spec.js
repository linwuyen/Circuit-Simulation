const {test,expect}=require('@playwright/test');
const {flushEvidence}=require('./evidence-fixture');
async function open(page){await page.goto('/17_power_topology_control/');await expect(page.locator('[data-p5-case]').first()).toBeVisible();await flushEvidence(page);}
async function correct(page){return page.evaluate(()=>CircuitTopologyTransferV1.challengeSet(20260821)[0].expected);}
test('P5 first-answer result and score wait for a held evidence lock',async({page})=>{
 await open(page);const answer=await correct(page);
 await page.evaluate(async()=>{await new Promise(resolve=>navigator.locks.request(CircuitEvidence.KEY,()=>new Promise(release=>{window.releaseP5Lock=release;resolve();})));});
 const card=page.locator('[data-p5-case]').first();await card.getByRole('button',{name:answer,exact:true}).click();
 await expect(card.locator('[data-p5-result]')).toContainText('尚未接受');
 await expect(page.locator('#p5ChallengeScore')).toHaveText('0/5 首次符合模型');
 await expect(card.locator('button').first()).toBeDisabled();
 await page.evaluate(()=>releaseP5Lock());
 await expect(card.locator('[data-p5-result]')).toContainText('✓ 首次判斷符合模型');
 await expect(page.locator('#p5ChallengeScore')).toHaveText('1/5 首次符合模型');
 await page.reload();await expect(page.locator('#p5ChallengeScore')).toHaveText('1/5 首次符合模型');
});
test('P5 quota failure leaves first answer unaccepted, exportable, and retry restores usability',async({page})=>{
 await open(page);const answer=await correct(page);
 await page.evaluate(()=>{window.p5OriginalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===CircuitEvidence.KEY)throw new DOMException('full','QuotaExceededError');return p5OriginalSetItem.call(this,k,v);};});
 const card=page.locator('[data-p5-case]').first();await card.getByRole('button',{name:answer,exact:true}).click();
 await expect(card.locator('[data-p5-result]')).toContainText('尚未接受');
 await expect(page.locator('#p5ChallengeScore')).toHaveText('0/5 首次符合模型');
 await expect(card.locator('button').first()).toBeDisabled();
 expect(await page.evaluate(()=>CircuitEvidence.exportBackup())).toContain(answer);
 await expect(page.locator('#learning-storage-status').getByRole('button',{name:'匯出備份'})).toBeEnabled();
 await page.evaluate(()=>Storage.prototype.setItem=p5OriginalSetItem);
 await page.locator('#learning-storage-status').getByRole('button',{name:'重試儲存'}).click();
 await expect(page.locator('#p5ChallengeScore')).toHaveText('1/5 首次符合模型');
 await expect(card.locator('button').first()).toBeEnabled();
 const different=await page.evaluate(()=>{const c=CircuitTopologyTransferV1.challengeSet(20260821)[0];return c.choices.find(answer=>answer!==c.expected);});
 await card.getByRole('button',{name:different,exact:true}).click();await page.reload();
 await expect(page.locator('#p5ChallengeScore')).toHaveText('1/5 首次符合模型');
});
test('P5 cached concept rows cannot overwrite another tab and local rejected answer stays exportable',async({page,context})=>{
 await open(page);const other=await context.newPage();await open(other);
 const first=page.locator('[data-p5-case]').first();await first.locator('button').first().click();
 await expect(first.locator('[data-p5-result]')).not.toContainText('尚未');await flushEvidence(page);
 const durable=await page.evaluate(()=>JSON.stringify(CircuitEvidence.load().benchmark.learningWorkspace.topologyConcepts));
 const second=other.locator('[data-p5-case]').nth(1);const local=await second.locator('button').first().getAttribute('data-p5-answer');
 await second.locator('button').first().click();
 await expect(second.locator('[data-p5-result]')).toContainText('紀錄已變更');
 await expect(second.locator('[data-p5-result]')).toContainText('尚未接受');
 expect(await page.evaluate(()=>JSON.stringify(CircuitEvidence.load().benchmark.learningWorkspace.topologyConcepts))).toBe(durable);
 const download=other.waitForEvent('download');await second.getByRole('button',{name:'匯出未接受判斷'}).click();
 const artifact=await download;let text='';for await(const chunk of await artifact.createReadStream())text+=chunk;
 expect(JSON.parse(text).attempted.answer).toBe(local);
 expect(JSON.parse(text).status).toBe('unaccepted-conflict');
});
test('P5 unsupported concept version remains intact and offers no first-answer writes',async({page})=>{
 await open(page);
 await page.evaluate(async()=>{const s=CircuitEvidence.load();s.benchmark.learningWorkspace||={version:1};s.benchmark.learningWorkspace.topologyConcepts={version:99,rows:{future:{first:{answer:'keep-original'}}},futureData:['preserve']};CircuitEvidence.save(s);if(!(await CircuitEvidence.flush()).saved)throw Error('fixture save refused');});
 await page.reload();
 await expect(page.locator('#p5ChallengeList')).toContainText('不支援');
 await expect(page.locator('[data-p5-answer]')).toHaveCount(0);
 expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.topologyConcepts)).toEqual({version:99,rows:{future:{first:{answer:'keep-original'}}},futureData:['preserve']});
});
