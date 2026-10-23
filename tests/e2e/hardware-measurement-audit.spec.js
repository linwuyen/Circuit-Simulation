const {test,expect}=require('@playwright/test');
for(const route of ['afe.html','simulator-core.html'])test(`AFE ${route} displays measured zero-current PF rather than a fabricated high score`,async({page})=>{
 await page.goto('/9.afe-tutorial/'+route);
 await page.evaluate(()=>{
  settings.innerKp=0;settings.innerKi=0;ctrl.i_out=0;sysState.i_grid_actual=0;
  scopeBuffer.i_grid.fill(0);simActive=true;
  for(let n=0;n<1000;n++)runAfeEngine();simActive=false;updateWidgets();
 });
 await expect(page.locator('#stat-pf')).toHaveText('0.000');
 await expect(page.locator('#stat-vbus')).not.toContainText('NaN');
});
test('DDS displays signed reverse power PF after deterministic post-timeout recovery',async({page})=>{
 await page.goto('/11.c2000_dds_dashboard/index.html');
 await page.evaluate(()=>{
  isRunning=false;
  Object.assign(pml,{nSamples:pml.nSamplesMax,prevSign:1,vSqrSum:1e12,pSum:1e12,pRmsSumMul:1e12,slewPowerUpdate:9});runPML(2048,2048);
  for(let n=0;n<30000;n++){
   const theta=2*Math.PI*50*n/20000;
   runPML(2048+120*Math.sin(theta)*(1.2*4095/3.3)/155,2048+15*Math.sin(theta-5*Math.PI/6)*(1.2*4095/3.3)/30);
  }
  updateUIElements(pml.vEma,pml);
 });
 await expect(page.locator('#disp-pf')).toHaveText('-0.866');
 await expect(page.locator('#disp-vrms')).toHaveText('84.85');
 await expect(page.locator('#cal-dynamic')).toContainText('整週期平均');
});
test('BMS IPC handshake teaches the dedicated CPU-to-CM message RAM',async({page})=>{
 await page.goto('/7.28388d_bms_tutorial/07_coordinate.html');
 await page.locator('#ipc-step').click();await page.locator('#ipc-step').click();
 await expect(page.locator('#ipc-lock')).toContainText('ACK');
 await expect(page.locator('#cm4-rx')).toHaveText('0x0FA0');
 await expect(page.locator('.reg-note')).toContainText('CM 不可直接讀 GS RAM');
});
test('ADC settling status agrees with RC error, not a fixed 550 ns safe label',async({page})=>{
 await page.goto('/6.10μs 高頻控制迴路模擬器/教學版/03-adc.html');
 await expect(page.locator('#statusBox')).toContainText('3.57%');
 await expect(page.locator('#statusBox')).toContainText('未達 12-bit');
 await page.locator('#acq').fill('1800');await page.locator('#acq').dispatchEvent('input');
 await expect(page.locator('#statusBox')).toContainText('符合本 RC 模型');
});
