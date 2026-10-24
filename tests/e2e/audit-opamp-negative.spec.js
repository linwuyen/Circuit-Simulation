const {test,expect}=require('@playwright/test');
test('step metric and plotted first-order response agree after positive, negative and zero changes',async({page})=>{
 await page.goto('/12_opamp_slew_rate/lab_step.html');
 for(const step of ['8','-8','0']){
  await page.locator('#op-step').fill(step);
  const r=await page.evaluate(()=>{
   const m=CircuitOpampSimulator.metrics(),s=CircuitOpampSimulator.simulate(m,'step');
   const index=s.timeUs.findIndex(t=>t>=s.stepStartUs+m.settleUs);
   return {settle:m.settleUs,error:Math.abs(s.actual[index]-m.step),band:Math.abs(m.step)*m.tol/100};
  });
  await expect(page.locator('#op-settle-time')).toHaveText(r.settle.toFixed(2)+' µs');
  expect(r.error).toBeLessThanOrEqual(r.band+1e-12);
 }
 await expect(page.locator('#op-state')).toContainText('ZERO STEP');
 await expect(page.locator('#op-settle-time')).toHaveText('0.00 µs');
});
test('AD5543 polarity lesson discloses missing bipolar offset stage',async({page})=>{
 await page.goto('/8.ad5543_simulator/05-polarity.html');
 await page.locator('#modeBtn').click();
 await expect(page.locator('#mathModel')).toContainText('5.0000 V');
 await expect(page.locator('.takeaways')).toContainText('不是四象限');
 await expect(page.locator('body')).toContainText('D/32768 − 1');
});
