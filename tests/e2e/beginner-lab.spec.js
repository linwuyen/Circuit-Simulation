const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{await page.goto('/15_power_capstone/learn_basics.html');await page.evaluate(()=>localStorage.clear());await page.reload();});
async function predict(page,value){await page.locator(`input[name=prediction][value="${value}"]`).check();await page.locator('#predict').click();}
async function prove(page,id='duty'){const c=await page.evaluate(id=>CircuitPlainCourse.checks[id],id);await page.locator(`input[name=observation][value="${c.observed}"]`).check();await page.locator('#observation-submit').click();await page.locator(`input[name=reason][value="${c.because}"]`).check();await page.locator('#reason-submit').click();}
async function control(page,value){await page.locator('#experiment-control').fill(String(value));}
test('first lesson guides an incorrect guess through observation, hints, transfer and reload',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await expect(page.locator('#experiment-control')).toBeDisabled();await expect(page.locator('[data-stage="1"]')).toBeHidden();await expect(page.locator('#transfer-section')).toBeHidden();
  await predict(page,'down');await control(page,50);await expect(page.locator('#output-voltage')).toHaveText('24.00 V');
  await page.locator('#hint').click();await page.locator('#hint').click();await page.locator('#hint').click();await expect(page.locator('#hints li')).toHaveCount(3);
  await prove(page);await page.locator('#transfer-value').fill('12');await page.locator('#transfer-submit').click();await expect(page.locator('#next-lesson')).toBeHidden();
  await page.locator('#transfer-value').fill('18');await page.locator('#transfer-submit').click();await expect(page.locator('#progress')).toContainText('1 / 5');
  await page.reload();await expect(page.locator('#progress')).toContainText('1 / 5');await page.getByRole('button',{name:'1. 先猜',exact:true}).click();await expect(page.locator('input[name=prediction][value=down]')).toBeChecked();
  const row=await page.evaluate(()=>CircuitEvidence.load().benchmark.beginnerLessons.rows.duty);expect(row.first.correct).toBe(false);expect(row.transferFirst.correct).toBe(false);expect(row.transferPassed).toBe(true);
  expect(errors).toEqual([]);
});
test('five lessons finish with synchronized circuit, model boundary, probe and timing',async({page})=>{
  const cases=[['duty','up',50,'18'],['inductor','fall',60,'fall'],['load','zero',100,'no'],['probe','tenth',1,'0.3'],['timing','20',11,'10']];
  for(const [id,answer,target,transfer]of cases){
    await page.goto('/15_power_capstone/learn_basics.html#'+id);await predict(page,answer);await control(page,target);
    if(id==='inductor'){await expect(page.locator('#instant-state')).toContainText('二極體續流');await expect(page.locator('#off-path')).toBeVisible();await expect(page.locator('#on-path')).toBeHidden();}
    if(id==='load'){await page.locator('#time-cursor').fill('99');await expect(page.locator('#instant-state')).toContainText('已歸零');await expect(page.locator('#output-voltage')).toHaveText('20.36 V');}
    if(id==='probe'){await expect(page.locator('#actual-current')).toHaveText('2.40 A');await expect(page.locator('#display-current')).toHaveText('0.24 A');}
    if(id==='timing')await expect(page.locator('#timing-result')).toContainText('20 微秒');
    await prove(page,id);
    if(await page.locator('#transfer-value').count())await page.locator('#transfer-value').fill(transfer);else await page.locator(`input[name=transfer][value="${transfer}"]`).check();
    await page.locator('#transfer-submit').click();await expect(page.locator('#next-lesson')).toBeEnabled();
  }
  await expect(page.locator('#progress')).toContainText('5 / 5');
});
test('playback pauses, stepping moves cursor, mobile layout fits and glossary is keyboard accessible',async({page})=>{
  await predict(page,'up');const before=await page.locator('#cursor').getAttribute('x1');await page.locator('#step').click();expect(await page.locator('#cursor').getAttribute('x1')).not.toBe(before);
  await page.locator('#play').click();await expect(page.locator('#play')).toHaveText('暫停');await page.locator('#play').click();await expect(page.locator('#play')).toHaveText('播放慢動作');
  await page.locator('#glossary-panel > summary').click();const summary=page.locator('#glossary summary').first();await summary.focus();await page.keyboard.press('Enter');await expect(page.locator('#glossary details').first()).toHaveAttribute('open','');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('#wave-line').getAttribute('points')).not.toMatch(/NaN|Infinity/);
});
