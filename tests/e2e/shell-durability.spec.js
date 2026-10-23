const {test,expect}=require('@playwright/test');
async function hold(page){await page.evaluate(async()=>{await CircuitEvidence.flush();await new Promise(resolve=>navigator.locks.request(CircuitEvidence.KEY,()=>new Promise(release=>{window.release=release;resolve();})));});}
test('quiz keeps current question and hides answer feedback until durable',async({page})=>{
 await page.goto('/quiz.html');await hold(page);const card=page.locator('.quiz-card[data-current-question]').first(),id=await card.getAttribute('data-current-question');await card.locator('[data-question]').first().click();
 expect(await card.getAttribute('data-current-question')).toBe(id);await expect(card.locator('.quiz-result')).toContainText('尚未儲存');await expect(card.locator('[data-question]').first()).toBeDisabled();
 await page.evaluate(()=>release());await expect(card.locator('.quiz-result')).not.toContainText('尚未儲存');await expect(card.locator('.quiz-explain')).toBeVisible();
});
test('numeric answer feedback waits for durable first response',async({page})=>{
 await page.goto('/quiz.html?module=buck');await page.locator('.core-page-library > summary').click();const button=page.locator('[data-numeric-submit]').first(),id=await button.getAttribute('data-numeric-submit');await page.locator(`[data-numeric-answer="${id}"]`).fill('1');await hold(page);await button.click();
 const result=page.locator(`[data-numeric-result="${id}"]`);await expect(result).toContainText('尚未儲存');await expect(button).toBeDisabled();await page.evaluate(()=>release());await expect(result).not.toContainText('尚未儲存');await expect(result).not.toBeEmpty();
});
test('beginner lesson navigation waits for durable view record',async({page})=>{
 await page.goto('/beginner.html');await page.addScriptTag({url:'/assets/learning/learning-v3.js'});await page.evaluate(()=>CircuitLearning.renderBeginner('app'));await hold(page);const link=page.locator('[data-view]').first(),id=await link.getAttribute('data-view');await link.click();expect(new URL(page.url()).pathname).toBe('/beginner.html');await page.evaluate(()=>release());await expect(page).not.toHaveURL(/beginner\.html$/);expect(await page.evaluate(id=>JSON.parse(localStorage.getItem('circuit-learning-state-v5')).evidence[id].level,id)).toBeGreaterThanOrEqual(1);
});
test('quiz quota failure withholds feedback and gives recovery instructions after retry',async({page})=>{
 await page.goto('/quiz.html');await page.evaluate(async()=>{await CircuitEvidence.flush();window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===CircuitEvidence.KEY)throw new DOMException('quota','QuotaExceededError');return originalSetItem.call(this,k,v);};});
 const card=page.locator('.quiz-card[data-current-question]').first();await card.locator('[data-question]').first().click();await expect(card.locator('.quiz-result')).toContainText('尚未儲存（QuotaExceededError）');await expect(card.locator('.quiz-explain')).toHaveCount(0);
 await page.evaluate(()=>{Storage.prototype.setItem=originalSetItem;});await page.locator('#learning-storage-status button').filter({hasText:'重試儲存'}).click();await expect(card.locator('.quiz-result')).toContainText('重試儲存已成功；請重新整理');
});
test('diagnostic score is withheld until durable acceptance',async({page})=>{
 await page.goto('/troubleshooting.html');await page.addScriptTag({url:'/assets/learning/learning-v3.js'});await page.evaluate(()=>CircuitLearning.renderTrouble('app'));await hold(page);
 const game=page.locator('.diagnostic-game').first();await game.locator('[data-game-cause]').first().click();await expect(game.locator('.game-score')).toContainText('尚未儲存');await expect(game.locator('[data-game-cause]').first()).toBeDisabled();await page.evaluate(()=>release());await expect(game.locator('.game-score')).not.toContainText('尚未儲存');await expect(game.locator('.game-score')).toContainText('Root cause');
});
test('manual practice does not repaint accepted evidence before durable commit',async({page})=>{
 await page.goto('/beginner.html');await page.addScriptTag({url:'/assets/learning/learning-v3.js'});await page.evaluate(()=>CircuitLearning.renderBeginner('app'));await hold(page);
 const button=page.locator('[data-practice]').first(),lesson=button.locator('xpath=ancestor::article[1]'),id=await button.getAttribute('data-practice');await button.click();await expect(button).toContainText('尚未儲存');await expect(lesson.locator('.evidence-level')).toHaveClass(/level-0/);await page.evaluate(()=>release());await expect(page.locator(`[data-practice="${id}"]`).locator('xpath=ancestor::article[1]').locator('.evidence-level')).toHaveClass(/level-2/);
});
