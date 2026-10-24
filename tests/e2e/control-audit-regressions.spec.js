const {test,expect}=require('@playwright/test');

test('undamped LCL multiple crossings cannot claim CLOSED',async({page})=>{
 await page.goto('/18_control_unification/engineering-workbench.html');
 await page.locator('#plantSelect').selectOption('inverter-lcl');
 await page.locator('#fc').evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#loopStatus')).toHaveText('CHECK BOUNDARY');
 await expect(page.locator('#loopBoundary')).toContainText('MULTIPLE (3 unity-gain intersections');
 await expect(page.locator('#actualPm')).toHaveText('—');
 await expect(page.locator('#actualFc')).toHaveText('—');
});
for(const file of ['pi.html','06_stability.html','07_challenge.html'])test(`Module4 ${file} revokes first-margin claim with multiple crossings`,async({page})=>{
 await page.goto('/4_PI/'+file);
 for(const [id,value] of [['kp-slider','0.1'],['ki-slider','3600']])await page.locator('#'+id).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
 if(file==='07_challenge.html'){
  await expect(page.locator('#r-pm')).toHaveText('--');
  await expect(page.locator('#r-fc')).toHaveText('多重交越');
 }else{
  await expect(page.locator('#narrative')).toContainText('多重 0 dB 交越');
  await expect(page.locator('#pm-val')).toHaveText('--');
 }
});

test('synthetic SFRA labels phase-only delay and never pretends to be measured',async({page})=>{
 await page.goto('/16_control_transforms/index.html');
 await page.locator('#sweepButton').click();
 await expect(page.locator('#sweepFreq')).toHaveText('10 kHz',{timeout:10000});
 expect(await page.locator('#modelMag').textContent()).toBe(await page.locator('#measuredMag').textContent());
 const phase=selector=>page.locator(selector).textContent().then(parseFloat);
 expect((await phase('#measuredPhase'))-(await phase('#modelPhase'))).toBeCloseTo(-36,1);
 await expect(page.locator('#sweepVerdict')).toContainText('非實測證據');
});
