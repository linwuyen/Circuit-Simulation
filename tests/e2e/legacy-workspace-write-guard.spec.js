const {test,expect}=require('@playwright/test');
const key='circuit-learning-state-v5';
async function editStored(page,change){await page.evaluate(({key,change})=>{const state=JSON.parse(localStorage.getItem(key));new Function('state',change)(state);localStorage.setItem(key,JSON.stringify(state));},{key,change});}
async function saveHint(page){await page.locator('#ws-hint').evaluate(el=>{el.open=true;el.dispatchEvent(new Event('toggle'));});}
test('legacy hint save preserves newer continuous experiment evidence',async({page})=>{
 await page.goto('/index.html#duty');
 await expect(page.locator('#ws-title')).not.toBeEmpty();
 await editStored(page,"state.benchmark.learningWorkspace.experiment={version:1,rows:{external:{first:{answer:'keep'}}}};");
 await saveHint(page);
 const answer=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).benchmark.learningWorkspace.experiment.rows.external.first.answer,key);
 expect(answer).toBe('keep');
 await expect(page.locator('#legacy-record-protection')).toHaveCount(0);
});
for(const [name,change] of [['unsupported root',"state.benchmark.learningWorkspace={version:99,sentinel:'keep'};"],['same-version first answer',"state.benchmark.beginnerLessons||={version:1,rows:{}};state.benchmark.beginnerLessons.rows.duty={first:{answer:'external',correct:false}};"]])test(`legacy saves fail closed on ${name}`,async({page})=>{
 await page.goto('/index.html#duty');
 await editStored(page,change);
 const before=await page.evaluate(key=>localStorage.getItem(key),key);
 await saveHint(page);
 await expect(page.locator('#legacy-record-protection')).toBeVisible();
 expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(before);
});
